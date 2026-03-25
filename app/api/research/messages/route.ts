import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = parseInt(searchParams.get('project_id') ?? '0', 10);
  const moduleId  = searchParams.get('module_id') ?? '';

  if (!projectId || !moduleId) {
    return Response.json({ error: 'project_id and module_id required' }, { status: 400 });
  }

  if (!isDbConfigured()) return Response.json({ messages: [] });

  try {
    await runResearchMigrations();
    const result = await sql`
      SELECT * FROM research_messages
      WHERE project_id = ${projectId} AND module_id = ${moduleId}
      ORDER BY created_at ASC
    `;
    return Response.json({ messages: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    project_id: number;
    module_id: string;
    role: string;
    content: string;
  };
  const { project_id, module_id, role, content } = body;

  if (!project_id || !module_id || !role || !content) {
    return Response.json({ error: 'project_id, module_id, role, content required' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({
      message: { id: Date.now(), project_id, module_id, role, content, created_at: new Date().toISOString() },
    });
  }

  try {
    await runResearchMigrations();

    const result = await sql`
      INSERT INTO research_messages (project_id, module_id, role, content)
      VALUES (${project_id}, ${module_id}, ${role}, ${content})
      RETURNING *
    `;

    // Upsert module touch
    await sql`
      INSERT INTO research_module_touches (project_id, module_id)
      VALUES (${project_id}, ${module_id})
      ON CONFLICT (project_id, module_id) DO UPDATE SET last_touched_at = NOW()
    `;

    return Response.json({ message: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
