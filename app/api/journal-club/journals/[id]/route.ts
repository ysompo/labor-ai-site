import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await jwtVerify(token, SECRET);

    const result = await sql`
      SELECT id, name, publisher, toc_url, issn, has_new_issue, current_issue_label
      FROM jc_journals
      WHERE id = ${parseInt(params.id)}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    return NextResponse.json({ journal: result.rows[0] });
  } catch (error) {
    console.error('Get journal error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await jwtVerify(token, SECRET);

    await sql`
      DELETE FROM jc_journals
      WHERE id = ${parseInt(params.id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete journal error:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal' },
      { status: 500 }
    );
  }
}
