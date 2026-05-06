import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) return Response.json({ error: 'project_id required' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ sections: [] });

  try {
    await runResearchMigrations();
    const result = await sql`
      SELECT * FROM research_brief
      WHERE project_id = ${projectId}::BIGINT
      ORDER BY module_id
    `;
    return Response.json({ sections: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { project_id: number; module_id: string; content: Record<string, unknown> };
  const { project_id, module_id, content } = body;
  if (!project_id || !module_id || !content) {
    return Response.json({ error: 'project_id, module_id, content required' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({ section: { project_id, module_id, content, updated_at: new Date().toISOString() } });
  }

  try {
    await runResearchMigrations();
    const result = await sql`
      INSERT INTO research_brief (project_id, module_id, content, updated_at)
      VALUES (${project_id}, ${module_id}, ${JSON.stringify(content)}, NOW())
      ON CONFLICT (project_id, module_id)
      DO UPDATE SET content = ${JSON.stringify(content)}, updated_at = NOW()
      RETURNING *
    `;
    return Response.json({ section: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
