import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/journal-club/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyJWT(token);
    const userId = verified.userId as number;

    const result = await sql`
      SELECT
        rl.id,
        COALESCE(a.id, ta.id) as article_id,
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

    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error('Get reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reading list' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyJWT(token);
    const userId = verified.userId as number;
    const { article_id, toc_article_id } = await request.json();

    // Validate that at least one ID is provided
    if (!article_id && !toc_article_id) {
      return NextResponse.json(
        { error: 'Either article_id or toc_article_id must be provided' },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO jc_reading_list (user_id, article_id, toc_article_id)
      VALUES (${userId}, ${article_id || null}, ${toc_article_id || null})
      ON CONFLICT DO NOTHING
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add to reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to add to reading list' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyJWT(token);
    const userId = verified.userId as number;
    const { article_id, toc_article_id } = await request.json();

    if (!article_id && !toc_article_id) {
      return NextResponse.json(
        { error: 'Either article_id or toc_article_id is required' },
        { status: 400 }
      );
    }

    if (toc_article_id) {
      await sql`
        DELETE FROM jc_reading_list
        WHERE user_id = ${userId} AND toc_article_id = ${toc_article_id}
      `;
    } else {
      await sql`
        DELETE FROM jc_reading_list
        WHERE user_id = ${userId} AND article_id = ${article_id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove from reading list error:', error);
    return NextResponse.json(
      { error: 'Failed to remove from reading list' },
      { status: 500 }
    );
  }
}
