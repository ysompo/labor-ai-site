import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@/lib/research/system-prompts';
import { buildCatalogSummary, searchCatalog } from '@/lib/research/catalog';
import type { ModuleId, ChatMessage } from '@/lib/research/types';

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
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured on this server.' }, { status: 503 });
  }

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

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      try {
        // Agentic loop: resolve all tool calls before streaming the final answer
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
            // Final response — stream it word-by-word for UX
            for (const block of response.content) {
              if (block.type === 'text') {
                // Stream in ~30-char chunks for a live feel
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

          // Handle tool calls
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              const input = block.input as { query?: string; category?: string };
              send({ type: 'tool', text: `🔍 מחפש בקטלוג: "${input.query}"` });
              const results = await searchCatalog(input.query ?? '', input.category);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(results),
              });
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
