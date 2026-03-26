import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (!taskId) return Response.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json() as {
    title?: string;
    description?: string;
    status?: string;
    due_date?: string | null;
    completed_at?: string | null;
    display_order?: number;
  };

  if (!isDbConfigured()) {
    return Response.json({ task: { id: taskId, ...body } });
  }

  try {
    await runResearchMigrations();

    // Verify ownership via project join
    const ownerCheck = await sql`
      SELECT t.id FROM research_tasks t
      JOIN research_projects p ON p.id = t.project_id
      WHERE t.id = ${taskId} AND p.user_id = ${parseInt(userId, 10)}
    `;
    if (!ownerCheck.rows[0]) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Build dynamic SET clause using individual conditional updates
    const { title, description, status, due_date, completed_at, display_order } = body;

    const result = await sql`
      UPDATE research_tasks SET
        title          = COALESCE(${title ?? null}, title),
        description    = CASE WHEN ${description !== undefined} THEN ${description ?? null} ELSE description END,
        status         = COALESCE(${status ?? null}, status),
        due_date       = CASE WHEN ${due_date !== undefined} THEN ${due_date ?? null} ELSE due_date END,
        completed_at   = CASE WHEN ${completed_at !== undefined} THEN ${completed_at ?? null} ELSE completed_at END,
        display_order  = COALESCE(${display_order ?? null}, display_order)
      WHERE id = ${taskId}
      RETURNING *
    `;

    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ task: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = parseInt(id, 10);
  if (!taskId) return Response.json({ error: 'Invalid id' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ ok: true });

  try {
    await runResearchMigrations();
    const ownerCheck = await sql`
      SELECT t.id FROM research_tasks t
      JOIN research_projects p ON p.id = t.project_id
      WHERE t.id = ${taskId} AND p.user_id = ${parseInt(userId, 10)}
    `;
    if (!ownerCheck.rows[0]) return Response.json({ error: 'Forbidden' }, { status: 403 });

    await sql`DELETE FROM research_tasks WHERE id = ${taskId}`;
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
