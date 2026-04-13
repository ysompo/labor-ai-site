import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, decryptCredentials } from '@/lib/journal-club/auth';
import { downloadPDFWithAuth } from '@/lib/journal-club/playwright';

/**
 * POST /api/journal-club/download
 * Download a PDF from an article URL using Playwright with HUJI authentication
 *
 * Request body:
 * {
 *   "article_url": string,
 *   "article_title": string (optional)
 * }
 *
 * Returns: PDF file with Content-Type: application/pdf
 */

/**
 * Validate that a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extract and verify JWT from sim_auth cookie
    const token = request.cookies.get('sim_auth')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId: number;
    let isAdmin: boolean;
    try {
      const verified = await verifyJWT(token);
      userId = verified.userId as number;
      isAdmin = verified.isAdmin as boolean;
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can download PDFs using shared credentials
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { article_url, article_title } = body;

    if (!article_url) {
      return NextResponse.json(
        { error: 'Missing required field: article_url' },
        { status: 400 }
      );
    }

    // Validate article_url is a proper URL
    if (!isValidUrl(article_url)) {
      return NextResponse.json(
        { error: 'Invalid article URL format' },
        { status: 400 }
      );
    }

    // Query jc_settings for admin's HUJI credentials
    // Look for encrypted HUJI credentials where key='huji_creds'
    const credentialsResult = await sql`
      SELECT encrypted_value
      FROM jc_settings
      WHERE key = 'huji_creds'
        AND user_id = (
          SELECT id FROM sim_users WHERE is_admin = TRUE LIMIT 1
        )
    `;

    if (credentialsResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'HUJI credentials not configured' },
        { status: 400 }
      );
    }

    // Decrypt HUJI credentials
    let hujiCreds;
    try {
      const encryptedValue = credentialsResult.rows[0].encrypted_value as string;
      hujiCreds = decryptCredentials(encryptedValue);
    } catch (error) {
      console.error('Failed to decrypt HUJI credentials:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt credentials' },
        { status: 500 }
      );
    }

    // Download PDF using Playwright with timeout (5 minutes max)
    const downloadTimeout = 5 * 60 * 1000; // 5 minutes
    const timeoutPromise = new Promise<Buffer>((_, reject) =>
      setTimeout(() => reject(new Error('PDF download timeout')), downloadTimeout)
    );

    let pdfBuffer: Buffer | null;
    try {
      pdfBuffer = await Promise.race([
        downloadPDFWithAuth(article_url, hujiCreds),
        timeoutPromise,
      ]) as Buffer | null;
    } catch (timeoutError) {
      if (timeoutError instanceof Error && timeoutError.message === 'PDF download timeout') {
        return NextResponse.json(
          { error: 'PDF download timed out after 5 minutes' },
          { status: 504 }
        );
      }
      throw timeoutError;
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: 'Failed to download PDF' },
        { status: 500 }
      );
    }

    // Save article record to jc_articles table
    try {
      const title = article_title || 'Unknown Article';

      await sql`
        INSERT INTO jc_articles (user_id, title, url, downloaded_at)
        VALUES (${userId}, ${title}, ${article_url}, NOW())
      `;
    } catch (error) {
      console.error('Failed to save article record:', error);
      // Don't fail the entire request if saving fails, just log it
      // User gets the PDF but it won't be in history
    }

    // Return PDF file
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          (article_title || 'article').replace(/[^a-z0-9._-]/gi, '_') + '.pdf'
        )}"`,
      },
    });
  } catch (error) {
    console.error('PDF download error:', error);
    return NextResponse.json(
      { error: 'Failed to process download request' },
      { status: 500 }
    );
  }
}
