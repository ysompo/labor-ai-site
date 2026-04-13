import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/journal-club/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await verifyJWT(token);

    const journalId = parseInt(id);

    // Get journal
    const journalResult = await sql`
      SELECT id, name, current_issue_label FROM jc_journals WHERE id = ${journalId}
    `;

    if (journalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const journal = journalResult.rows[0];

    // Get articles for this journal
    const articlesResult = await sql`
      SELECT id, url, title, authors, article_type, doi, abstract, issue_label
      FROM jc_toc_articles
      WHERE journal_id = ${journalId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(articlesResult.rows);
  } catch (error) {
    console.error('Get TOC error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TOC' },
      { status: 500 }
    );
  }
}
