import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/journal-club/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await verifyJWT(token);

    // Get all journals (shared across users)
    const result = await sql`
      SELECT id, name, publisher, toc_url, issn, has_new_issue, current_issue_label
      FROM jc_journals
      ORDER BY name
    `;

    return NextResponse.json({ journals: result.rows });
  } catch (error) {
    console.error('Get journals error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
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

    await verifyJWT(token);

    const { name, publisher, toc_url, issn } = await request.json();

    const result = await sql`
      INSERT INTO jc_journals (name, publisher, toc_url, issn)
      VALUES (${name}, ${publisher || null}, ${toc_url}, ${issn || null})
      RETURNING id, name, publisher, toc_url, issn, has_new_issue
    `;

    return NextResponse.json(
      { journal: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create journal error:', error);
    return NextResponse.json(
      { error: 'Failed to create journal' },
      { status: 500 }
    );
  }
}
