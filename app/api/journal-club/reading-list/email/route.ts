import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/journal-club/auth';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Build HTML email
    interface Article {
      title: string;
      authors?: string[];
      doi?: string;
      abstract?: string;
    }
    const articles = listResult.rows as Article[];
    const htmlContent = `
      <h2>Your Journal Club Reading List</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${articles
          .map(
            (a) => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px;">
              <strong>${a.title}</strong><br/>
              ${a.authors?.join(', ') || ''}<br/>
              ${a.doi ? `DOI: <a href="https://doi.org/${a.doi}">${a.doi}</a>` : ''}<br/>
              ${a.abstract ? `<p>${a.abstract.substring(0, 500)}...</p>` : ''}
            </td>
          </tr>
        `
          )
          .join('')}
      </table>
    `;

    // Send email via Resend
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      await resend.emails.send({
        from: process.env.RESEND_FROM,
        to: userEmail,
        subject: 'Your Journal Club Reading List',
        html: htmlContent,
      });
    }

    // Clear reading list after sending
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
