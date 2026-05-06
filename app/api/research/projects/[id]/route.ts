import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const projectId = id;

  if (!isDbConfigured()) return Response.json({ ok: true });

  try {
    await runResearchMigrations();

    const ownership = await sql`
      SELECT id FROM research_projects
      WHERE id = ${projectId}::BIGINT AND user_id = ${parseInt(userId, 10)}
    `;
    if (!ownership.rows[0]) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Delete all related data (cascade)
    await sql`DELETE FROM research_tasks              WHERE project_id = ${projectId}::BIGINT`;
    await sql`DELETE FROM research_messages           WHERE project_id = ${projectId}::BIGINT`;
    await sql`DELETE FROM research_brief              WHERE project_id = ${projectId}::BIGINT`;
    await sql`DELETE FROM research_deferred_questions WHERE project_id = ${projectId}::BIGINT`;
    await sql`DELETE FROM research_module_touches     WHERE project_id = ${projectId}::BIGINT`;
    await sql`DELETE FROM research_projects           WHERE id = ${projectId}::BIGINT AND user_id = ${parseInt(userId, 10)}`;

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
