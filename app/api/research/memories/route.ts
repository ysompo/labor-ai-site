import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isDbConfigured()) return Response.json({ memories: [] });

  try {
    await runResearchMigrations();
    const result = await sql`
      SELECT * FROM research_memories
      WHERE user_id = ${parseInt(userId, 10)}
      ORDER BY created_at DESC
    `;
    return Response.json({ memories: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { content: string };
  const { content } = body;
  if (!content?.trim()) return Response.json({ error: 'content required' }, { status: 400 });

  if (!isDbConfigured()) {
    return Response.json({
      memory: { id: Date.now(), user_id: parseInt(userId, 10), content, created_at: new Date().toISOString() },
    });
  }

  try {
    await runResearchMigrations();
    const result = await sql`
      INSERT INTO research_memories (user_id, content)
      VALUES (${parseInt(userId, 10)}, ${content.trim()})
      RETURNING *
    `;
    return Response.json({ memory: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { id: number };
  const { id } = body;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ ok: true });

  try {
    await runResearchMigrations();
    await sql`
      DELETE FROM research_memories
      WHERE id = ${id} AND user_id = ${parseInt(userId, 10)}
    `;
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
