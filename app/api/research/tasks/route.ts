import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = parseInt(searchParams.get('project_id') ?? '0', 10);

  if (!projectId) return Response.json({ error: 'project_id required' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ tasks: [] });

  try {
    await runResearchMigrations();
    const ownership = await sql`
      SELECT id FROM research_projects WHERE id = ${projectId} AND user_id = ${parseInt(userId, 10)}
    `;
    if (!ownership.rows[0]) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const result = await sql`
      SELECT * FROM research_tasks
      WHERE project_id = ${projectId}
      ORDER BY display_order ASC, created_at ASC
    `;
    return Response.json({ tasks: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    project_id: number;
    title: string;
    description?: string;
    due_date?: string;
    is_ai_suggested?: boolean;
  };
  const { project_id, title, description, due_date, is_ai_suggested = false } = body;

  if (!project_id || !title?.trim()) {
    return Response.json({ error: 'project_id and title required' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({
      task: {
        id: Date.now(), project_id, title, description, status: 'pending',
        due_date, is_ai_suggested, display_order: 0, created_at: new Date().toISOString(), completed_at: null,
      },
    });
  }

  try {
    await runResearchMigrations();
    const ownership = await sql`
      SELECT id FROM research_projects WHERE id = ${project_id} AND user_id = ${parseInt(userId, 10)}
    `;
    if (!ownership.rows[0]) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const result = await sql`
      INSERT INTO research_tasks (project_id, title, description, due_date, is_ai_suggested)
      VALUES (
        ${project_id},
        ${title.trim()},
        ${description ?? null},
        ${due_date ?? null},
        ${is_ai_suggested}
      )
      RETURNING *
    `;
    return Response.json({ task: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
