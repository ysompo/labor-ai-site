import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = parseInt(searchParams.get('project_id') ?? '0', 10);

  if (!projectId) return Response.json({ error: 'project_id required' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ touches: [] });

  try {
    await runResearchMigrations();
    const result = await sql`
      SELECT module_id, first_touched_at, last_touched_at
      FROM research_module_touches
      WHERE project_id = ${projectId}
      ORDER BY first_touched_at ASC
    `;
    return Response.json({ touches: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
