import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/research/system-prompts';
import { buildCatalogSummary, searchCatalog } from '@/lib/research/catalog';
import type { ModuleId, ChatMessage } from '@/lib/research/types';
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured on this server.' }, { status: 503 });
  }

  const rawUserId = req.headers.get('x-user-id');
  const userId = rawUserId ? parseInt(rawUserId, 10) : 0;

  const body = await req.json() as {
    moduleId: ModuleId;
    messages: ChatMessage[];
    language?: 'he' | 'en';
    uploadedDataSummary?: string;
  };

  const { moduleId, messages, language = 'he', uploadedDataSummary } = body;
  if (!messages?.length) return Response.json({ error: 'No messages' }, { status: 400 });

  const catalogSummary = await buildCatalogSummary();
  let systemPrompt = buildSystemPrompt(moduleId, catalogSummary, language);
  if (uploadedDataSummary) systemPrompt += `\n\nUPLOADED DATASET SUMMARY:\n${uploadedDataSummary}`;

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
