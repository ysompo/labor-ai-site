import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/journal-club/auth';
import { Resend } from 'resend';

/**
 * Escape HTML special characters to prevent injection.
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyJWT(token);
    const userId = verified.userId as number;

    // Get reading list items
    const listResult = await sql`
      SELECT
        COALESCE(a.title, ta.title) as title,
        COALESCE(a.authors, ta.authors) as authors,
        COALESCE(a.doi, ta.doi) as doi,
        COALESCE(a.abstract, ta.abstract) as abstract
      FROM jc_reading_list rl
      LEFT JOIN jc_articles a ON rl.article_id = a.id
      LEFT JOIN jc_toc_articles ta ON rl.toc_article_id = ta.id
      WHERE rl.user_id = ${userId}
      ORDER BY rl.added_at DESC
    `;

    if (listResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reading list is empty' },
        { status: 400 }
      );
    }

    // Get user email
    const userResult = await sql`
      SELECT email FROM sim_users WHERE id = ${userId}
    `;

    const userEmail = userResult.rows[0]?.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Validate email service configuration before attempting send
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 503 }
      );
    }

    // Build HTML email
    interface Article {
      title: string;
      authors?: string[] | string | null;
      doi?: string;
      abstract?: string;
    }
    const articles = listResult.rows as Article[];

    // Helper to safely extract authors as string
    const formatAuthors = (authors: string[] | string | null | undefined): string => {
      if (!authors) return '';
      if (Array.isArray(authors)) return authors.join(', ');
      return String(authors);
    };

    const htmlContent = `
      <h2>Your Journal Club Reading List</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${articles
          .map(
            (a) => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px;">
              <strong>${escapeHtml(a.title)}</strong><br/>
              ${escapeHtml(formatAuthors(a.authors))}<br/>
              ${a.doi ? `DOI: <a href="https://doi.org/${escapeHtml(a.doi)}">${escapeHtml(a.doi)}</a>` : ''}<br/>
              ${a.abstract ? `<p>${escapeHtml(a.abstract.substring(0, 500))}...</p>` : ''}
            </td>
          </tr>
        `
          )
          .join('')}
      </table>
    `;

    // Send email via Resend (already validated config above)
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: userEmail,
      subject: 'Your Journal Club Reading List',
      html: htmlContent,
    });

    // Clear reading list after successful send
    await sql`DELETE FROM jc_reading_list WHERE user_id = ${userId}`;

    return NextResponse.json({ success: true, sent: articles.length });
  } catch (error) {
    console.error('Email reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to email reading list' },
      { status: 500 }
    );
  }
}
