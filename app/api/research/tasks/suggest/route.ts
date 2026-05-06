import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';
import { MODULE_META } from '@/lib/research/types';
import type { ModuleId } from '@/lib/research/types';

const MODEL = process.env.RESEARCH_ASSISTANT_MODEL ?? 'claude-sonnet-4-6';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });

  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    projectId: number;
    language?: 'he' | 'en';
    sourceModule?: string;
    recentMessages?: Array<{ role: string; content: string }>;
  };
  const { projectId, language = 'he', sourceModule, recentMessages = [] } = body;
  if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ tasks: [] });

  try {
    await runResearchMigrations();

    const ownership = await sql`
      SELECT id FROM research_projects WHERE id = ${projectId}::BIGINT AND user_id = ${parseInt(userId, 10)}
    `;
    if (!ownership.rows[0]) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const existingTasksResult = await sql`
      SELECT title, status FROM research_tasks
      WHERE project_id = ${projectId}::BIGINT AND source_module = ${sourceModule || null}
      ORDER BY created_at DESC
    `;
    const existingTasks = existingTasksResult.rows as Array<{ title: string; status: string }>;

    const moduleMeta = sourceModule ? MODULE_META[sourceModule as ModuleId] : null;
    const moduleLabel = moduleMeta
      ? (language === 'he' ? moduleMeta.labelHe : moduleMeta.label)
      : (sourceModule ?? 'this module');

    const today = new Date().toISOString().split('T')[0];

    // Build chat transcript (last 20 messages, compressed to assistant summaries + user inputs)
    const transcriptLines = recentMessages.map(m =>
      `${m.role === 'user' ? 'Resident' : 'AI'}: ${m.content.slice(0, 400)}${m.content.length > 400 ? '...' : ''}`
    );
    const transcript = transcriptLines.length > 0
      ? `CONVERSATION IN "${moduleLabel}" MODULE:\n${transcriptLines.join('\n\n')}`
      : `No conversation yet in the "${moduleLabel}" module.`;

    const existingText = existingTasks.length > 0
      ? `\n\nEXISTING TASKS FOR THIS MODULE (do NOT duplicate):\n${existingTasks.map(t => `- [${t.status}] ${t.title}`).join('\n')}`
      : '';

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: `You suggest 2-3 concrete next tasks for an OB/GYN researcher based ONLY on what was discussed in the "${moduleLabel}" module conversation. Tasks must be directly actionable follow-ups from that specific conversation — not generic project tasks.

Output ONLY a JSON array. Each task: {"title": "<short task in ${language === 'he' ? 'Hebrew' : 'English'}, under 60 chars>", "due_date": "<YYYY-MM-DD>"}.

Today is ${today}. Due dates: 1-3 weeks from today. Do NOT duplicate existing tasks. If there is no conversation yet, suggest 2 starter tasks appropriate for the "${moduleLabel}" module.`,
      messages: [{
        role: 'user',
        content: `${transcript}${existingText}\n\nSuggest 2-3 tasks.`,
      }],
    });

    let suggestedTasks: Array<{ title: string; due_date?: string }> = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        const match = block.text.match(/\[[\s\S]*\]/);
        if (match) {
          try { suggestedTasks = JSON.parse(match[0]); } catch { /* ignore */ }
        }
      }
    }

    const insertedTasks = [];
    for (const t of suggestedTasks.slice(0, 3)) {
      if (!t.title) continue;
      const result = await sql`
        INSERT INTO research_tasks (project_id, title, due_date, is_ai_suggested, source_module)
        VALUES (${projectId}::BIGINT, ${t.title.trim()}, ${t.due_date || null}, true, ${sourceModule || null})
        RETURNING *
      `;
      insertedTasks.push(result.rows[0]);
    }

    return Response.json({ tasks: insertedTasks });
  } catch (e) {
    console.error('[tasks/suggest]', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
