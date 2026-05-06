import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/research/system-prompts';
import { buildCatalogSummary, searchCatalog } from '@/lib/research/catalog';
import type { ModuleId, ChatMessage, BriefSection } from '@/lib/research/types';
import { MODULE_META } from '@/lib/research/types';
import { isDbConfigured, sql } from '@/lib/db';
import { runResearchMigrations } from '@/lib/research/db';

const MODEL = process.env.RESEARCH_ASSISTANT_MODEL ?? 'claude-sonnet-4-6';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_catalog',
    description: 'Search the departmental variable catalog. Returns matching variables with type, description, sample values, and coverage.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:    { type: 'string', description: 'Search term (variable name, concept, or keyword)' },
        category: { type: 'string', description: 'Optional: filter by category name' },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_memory',
    description: 'Save a user preference or important fact to persistent memory. Use when the user says "remember that...", "always...", "from now on...", or similar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The memory content to save (concise, 1-2 sentences)' },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_brief',
    description: 'Update this module\'s section in the shared Research Brief. Call this whenever a key decision is made — research question defined, variables selected, analysis plan outlined, etc. The brief is visible to all modules so they share context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        section: {
          type: 'object',
          description: 'Structured summary of this module\'s key outputs. Use relevant fields for the current module: researchQuestion, population, outcome, studyDesign, clinicalObservation, feasibilityNotes (ideation); selectedVariables, dataCompleteness (data-explorer); keyReferences, evidenceGaps, searchStrategy (lit-search); analysisPlan, primaryAnalysis, sampleSize, statisticalTests (stats); protocolVersion, irbStatus, keyInclusions, keyExclusions (protocol); targetJournal, abstractDraft, manuscriptStatus (manuscript); milestones, currentPhase, deadlines (schedule).',
        },
      },
      required: ['section'],
    },
  },
  {
    name: 'create_deferred_question',
    description: 'Flag a question that another module needs to answer. Use when you notice the research needs input from a different module — e.g., stats needs to know which variables are available (data-explorer), or protocol needs the analysis plan (stats).',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_module: { type: 'string', enum: ['ideation', 'data-explorer', 'lit-search', 'stats', 'protocol', 'manuscript', 'schedule'], description: 'Which module should answer this question' },
        question:      { type: 'string', description: 'The question to ask (clear and actionable)' },
        context:       { type: 'string', description: 'Why this question matters for the current module\'s work' },
      },
      required: ['target_module', 'question'],
    },
  },
];

async function getUserMemories(userId: number): Promise<string[]> {
  if (!isDbConfigured()) return [];
  try {
    await runResearchMigrations();
    const result = await sql`
      SELECT content FROM research_memories
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return result.rows.map((r) => String(r.content));
  } catch {
    return [];
  }
}

async function saveMemory(userId: number, content: string): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await runResearchMigrations();
    await sql`
      INSERT INTO research_memories (user_id, content)
      VALUES (${userId}, ${content.trim()})
    `;
  } catch (e) {
    console.error('[save_memory]', e);
  }
}

async function getBriefSections(projectId: number): Promise<BriefSection[]> {
  if (!isDbConfigured()) return [];
  try {
    await runResearchMigrations();
    const result = await sql`
      SELECT * FROM research_brief
      WHERE project_id = ${projectId}
      ORDER BY module_id
    `;
    return result.rows as BriefSection[];
  } catch {
    return [];
  }
}

function formatBriefForPrompt(sections: BriefSection[], currentModule: ModuleId): string {
  const otherSections = sections.filter(s => s.module_id !== currentModule);
  if (otherSections.length === 0) return '';
  const parts = otherSections.map(s => {
    const meta = MODULE_META[s.module_id as ModuleId];
    const label = meta ? `${meta.icon} ${meta.label}` : s.module_id;
    const content = typeof s.content === 'string' ? s.content : JSON.stringify(s.content, null, 2);
    return `### ${label}\n${content}`;
  });
  return `RESEARCH BRIEF (current state from other modules — use this context):\n\n${parts.join('\n\n')}`;
}

async function upsertBrief(projectId: number, moduleId: string, content: Record<string, unknown>): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await runResearchMigrations();
    await sql`
      INSERT INTO research_brief (project_id, module_id, content, updated_at)
      VALUES (${projectId}, ${moduleId}, ${JSON.stringify(content)}, NOW())
      ON CONFLICT (project_id, module_id)
      DO UPDATE SET content = ${JSON.stringify(content)}, updated_at = NOW()
    `;
  } catch (e) {
    console.error('[update_brief]', e);
  }
}

async function getDeferredQuestions(projectId: number, targetModule: string): Promise<Array<{ source_module: string; question: string; context?: string }>> {
  if (!isDbConfigured()) return [];
  try {
    await runResearchMigrations();
    const result = await sql`
      SELECT source_module, question, context FROM research_deferred_questions
      WHERE project_id = ${projectId} AND target_module = ${targetModule} AND status = 'pending'
      ORDER BY created_at DESC
    `;
    return result.rows as Array<{ source_module: string; question: string; context?: string }>;
  } catch {
    return [];
  }
}

async function createDeferredQuestion(
  projectId: number, sourceModule: string, targetModule: string, question: string, context?: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await runResearchMigrations();
    await sql`
      UPDATE research_deferred_questions
      SET status = 'resolved', resolved_at = NOW()
      WHERE project_id = ${projectId}
        AND source_module = ${sourceModule}
        AND target_module = ${targetModule}
        AND status = 'pending'
    `;
    await sql`
      INSERT INTO research_deferred_questions (project_id, source_module, target_module, question, context)
      VALUES (${projectId}, ${sourceModule}, ${targetModule}, ${question}, ${context || null})
    `;
  } catch (e) {
    console.error('[create_deferred_question]', e);
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured on this server.' }, { status: 503 });
  }

  const rawUserId = req.headers.get('x-user-id');
  const userId = rawUserId ? parseInt(rawUserId, 10) : 0;

  const body = await req.json() as {
    projectId?: number;
    moduleId: ModuleId;
    messages: ChatMessage[];
    language?: 'he' | 'en';
    gender?: 'm' | 'f';
    uploadedDataSummary?: string;
  };

  const { projectId, moduleId, messages, language = 'he', gender = 'm', uploadedDataSummary } = body;
  if (!messages?.length) return Response.json({ error: 'No messages' }, { status: 400 });

  const catalogSummary = await buildCatalogSummary();
  let systemPrompt = buildSystemPrompt(moduleId, catalogSummary, language, gender);
  if (uploadedDataSummary) systemPrompt += `\n\nUPLOADED DATASET SUMMARY:\n${uploadedDataSummary}`;

  // Inject cross-module brief context and pending questions
  if (projectId) {
    const briefSections = await getBriefSections(projectId);
    const briefContext = formatBriefForPrompt(briefSections, moduleId);
    if (briefContext) {
      systemPrompt += `\n\n${briefContext}`;
    }

    const pendingQuestions = await getDeferredQuestions(projectId, moduleId);
    if (pendingQuestions.length > 0) {
      const qLines = pendingQuestions.map((q, i) => {
        const meta = MODULE_META[q.source_module as ModuleId];
        const from = meta ? `${meta.icon} ${meta.label}` : q.source_module;
        return `${i + 1}. [From ${from}]: ${q.question}${q.context ? ` (Context: ${q.context})` : ''}`;
      }).join('\n');
      systemPrompt += `\n\nPENDING QUESTIONS FROM OTHER MODULES (address these proactively):\n${qLines}`;
    }
  }

  // Prepend user memories
  if (userId) {
    const memories = await getUserMemories(userId);
    if (memories.length > 0) {
      const memoriesText = memories.map(m => `- ${m}`).join('\n');
      systemPrompt = `USER MEMORIES (user-saved preferences, always follow these):\n${memoriesText}\n\n${systemPrompt}`;
    }
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      try {
        let currentMessages: Anthropic.MessageParam[] = messages.map(m => ({
          role: m.role,
          content: m.content,
        }));

        for (let i = 0; i < 5; i++) {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages: currentMessages,
            tools: TOOLS,
          });

          if (response.stop_reason !== 'tool_use') {
            for (const block of response.content) {
              if (block.type === 'text') {
                const text = block.text;
                const chunkSize = 30;
                for (let j = 0; j < text.length; j += chunkSize) {
                  send({ type: 'text', text: text.slice(j, j + chunkSize) });
                  await new Promise(r => setTimeout(r, 8));
                }
              }
            }
            break;
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              if (block.name === 'search_catalog') {
                const input = block.input as { query?: string; category?: string };
                send({ type: 'tool', text: `🔍 מחפש בקטלוג: "${input.query}"` });
                const results = await searchCatalog(input.query ?? '', input.category);
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(results),
                });
              } else if (block.name === 'save_memory') {
                const input = block.input as { content?: string };
                const memContent = input.content ?? '';
                if (memContent && userId) {
                  await saveMemory(userId, memContent);
                }
                send({ type: 'tool', text: '✅ נשמר לזיכרון' });
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: 'Memory saved successfully.',
                });
              } else if (block.name === 'update_brief') {
                const input = block.input as { section?: Record<string, unknown> };
                if (input.section && projectId) {
                  await upsertBrief(projectId, moduleId, input.section);
                }
                send({ type: 'tool', text: '📋 תקציר המחקר עודכן' });
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: 'Brief section updated successfully.',
                });
              } else if (block.name === 'create_deferred_question') {
                const input = block.input as { target_module?: string; question?: string; context?: string };
                if (input.target_module === moduleId) {
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: 'Error: Cannot send a question to the current module. Choose a different target_module.',
                  });
                  continue;
                }
                if (input.target_module && input.question && projectId) {
                  await createDeferredQuestion(projectId, moduleId, input.target_module, input.question, input.context);
                  const targetMeta = MODULE_META[input.target_module as ModuleId];
                  const targetLabel = targetMeta ? targetMeta.labelHe : input.target_module;
                  send({ type: 'tool', text: `❓ שאלה נשלחה למודול ${targetLabel}` });
                }
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: 'Deferred question created successfully.',
                });
              }
            }
          }

          currentMessages = [
            ...currentMessages,
            { role: 'assistant' as const, content: response.content },
            { role: 'user' as const,      content: toolResults },
          ];
        }

        send({ type: 'done' });
        controller.close();
      } catch (err) {
        send({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
