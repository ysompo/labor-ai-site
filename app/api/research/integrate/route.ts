import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';
import { MODULE_META } from '@/lib/research/types';
import type { ModuleId, BriefSection, DeferredQuestion } from '@/lib/research/types';

const MODEL = process.env.RESEARCH_ASSISTANT_MODEL ?? 'claude-sonnet-4-6';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });

  const body = await req.json() as { projectId: number; targetModuleId: ModuleId };
  const { projectId, targetModuleId } = body;
  if (!projectId || !targetModuleId) {
    return Response.json({ error: 'projectId, targetModuleId required' }, { status: 400 });
  }

  if (!isDbConfigured()) return Response.json({ questions: [] });

  try {
    await runResearchMigrations();

    const briefResult = await sql`
      SELECT * FROM research_brief WHERE project_id = ${projectId}
    `;
    const sections = briefResult.rows as BriefSection[];

    if (sections.length === 0) {
      return Response.json({ questions: [] });
    }

    const existingQResult = await sql`
      SELECT * FROM research_deferred_questions
      WHERE project_id = ${projectId} AND target_module = ${targetModuleId} AND status = 'pending'
    `;
    const existingQuestions = existingQResult.rows as DeferredQuestion[];

    const briefText = sections.map(s => {
      const meta = MODULE_META[s.module_id as ModuleId];
      const label = meta ? `${meta.icon} ${meta.label}` : s.module_id;
      const content = typeof s.content === 'string' ? s.content : JSON.stringify(s.content, null, 2);
      return `### ${label}\n${content}`;
    }).join('\n\n');

    const existingQText = existingQuestions.length > 0
      ? `\n\nEXISTING PENDING QUESTIONS for ${targetModuleId} (do NOT duplicate these):\n${existingQuestions.map(q => `- From ${q.source_module}: ${q.question}`).join('\n')}`
      : '';

    const targetMeta = MODULE_META[targetModuleId];

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You are a research supervisor reviewing an OB/GYN research project's progress. Your job is to identify gaps or inconsistencies that the "${targetMeta.label}" module needs to address, based on what other modules have established.

Output ONLY a JSON array of questions. Each question is an object: {"source_module": "<module that established the context>", "question": "<clear actionable question>", "context": "<why this matters>"}.

If everything looks consistent and nothing is missing, output an empty array: []

Do NOT duplicate existing pending questions. Only create NEW questions for genuinely missing information.`,
      messages: [{
        role: 'user',
        content: `RESEARCH BRIEF:\n\n${briefText}${existingQText}\n\nWhat questions should the "${targetMeta.label}" module answer based on the current brief state?`,
      }],
    });

    let questionsJson: Array<{ source_module: string; question: string; context?: string }> = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        const match = block.text.match(/\[[\s\S]*\]/);
        if (match) {
          try { questionsJson = JSON.parse(match[0]); } catch { /* ignore parse errors */ }
        }
      }
    }

    // Resolve all existing pending questions for this target before inserting fresh batch
    await sql`
      UPDATE research_deferred_questions
      SET status = 'resolved', resolved_at = NOW()
      WHERE project_id = ${projectId} AND target_module = ${targetModuleId} AND status = 'pending'
    `;

    const newQuestions: DeferredQuestion[] = [];
    for (const q of questionsJson) {
      if (!q.question || !q.source_module) continue;
      const result = await sql`
        INSERT INTO research_deferred_questions (project_id, source_module, target_module, question, context)
        VALUES (${projectId}, ${q.source_module}, ${targetModuleId}, ${q.question}, ${q.context || null})
        RETURNING *
      `;
      newQuestions.push(result.rows[0] as DeferredQuestion);
    }

    return Response.json({ questions: newQuestions });
  } catch (e) {
    console.error('[integrate]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
