import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');
  if (!projectId) return Response.json({ error: 'project_id required' }, { status: 400 });

  const targetModule = req.nextUrl.searchParams.get('target_module');
  const statusFilter = req.nextUrl.searchParams.get('status') || 'pending';

  if (!isDbConfigured()) return Response.json({ questions: [] });

  try {
    await runResearchMigrations();
    let result;
    if (targetModule) {
      result = await sql`
        SELECT * FROM research_deferred_questions
        WHERE project_id = ${projectId}::BIGINT
          AND target_module = ${targetModule}
          AND status = ${statusFilter}
        ORDER BY created_at DESC
      `;
    } else {
      result = await sql`
        SELECT * FROM research_deferred_questions
        WHERE project_id = ${projectId}::BIGINT
          AND status = ${statusFilter}
        ORDER BY created_at DESC
      `;
    }
    return Response.json({ questions: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    project_id: number;
    source_module: string;
    target_module: string;
    question: string;
    context?: string;
  };
  const { project_id, source_module, target_module, question, context } = body;
  if (!project_id || !source_module || !target_module || !question) {
    return Response.json({ error: 'project_id, source_module, target_module, question required' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({
      question: { id: Date.now(), project_id, source_module, target_module, question, context, status: 'pending', created_at: new Date().toISOString() },
    });
  }

  try {
    await runResearchMigrations();
    const result = await sql`
      INSERT INTO research_deferred_questions (project_id, source_module, target_module, question, context)
      VALUES (${project_id}, ${source_module}, ${target_module}, ${question}, ${context || null})
      RETURNING *
    `;
    return Response.json({ question: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as { id: number; status: 'dismissed' | 'resolved' };
  const { id, status } = body;
  if (!id || !status) return Response.json({ error: 'id, status required' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ ok: true });

  try {
    await runResearchMigrations();
    await sql`
      UPDATE research_deferred_questions
      SET status = ${status}, resolved_at = NOW()
      WHERE id = ${id}
    `;
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
