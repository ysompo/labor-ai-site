import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isDbConfigured()) return Response.json({ projects: [] });

  try {
    await runResearchMigrations();

    const result = await sql`
      SELECT
        p.*,
        COALESCE(
          (SELECT json_agg(rmt.module_id)
           FROM research_module_touches rmt
           WHERE rmt.project_id = p.id),
          '[]'::json
        ) AS touches,
        COALESCE(
          (SELECT COUNT(*)::int
           FROM research_tasks rt
           WHERE rt.project_id = p.id AND rt.status = 'pending'),
          0
        ) AS pending_tasks
      FROM research_projects p
      WHERE p.user_id = ${parseInt(userId, 10)}
      ORDER BY p.updated_at DESC
    `;

    return Response.json({ projects: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
