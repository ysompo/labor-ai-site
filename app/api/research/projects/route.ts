import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isDbConfigured()) return Response.json({ projects: [] });

  try {
    const result = await sql`
      SELECT * FROM research_projects
      WHERE user_id = ${parseInt(userId)}
      ORDER BY updated_at DESC
    `;
    return Response.json({ projects: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, language = 'he' } = await req.json() as { title: string; language?: string };
  if (!title?.trim()) return Response.json({ error: 'Title required' }, { status: 400 });

  if (!isDbConfigured()) {
    return Response.json({ project: { id: Date.now(), title, status: 'draft', language, user_id: parseInt(userId), created_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
  }

  try {
    const result = await sql`
      INSERT INTO research_projects (user_id, title, language)
      VALUES (${parseInt(userId)}, ${title.trim()}, ${language})
      RETURNING *
    `;
    return Response.json({ project: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
