import { NextRequest } from 'next/server';

const SYSTEM_PROMPT_SIMULATOR = `You are an AI assistant for creating obstetric simulation scenarios for a delivery room training program at Hadassah Medical Center. You help instructors create realistic clinical scenarios with progressive cards.

You work with this data structure:
SCENARIO: name, case_story (Hebrew), expected_actions (Hebrew), phases (Hebrew)
CARDS: ordered list, each with:
  - card_number, title
  - clinical_description (Hebrew free text)
  - structured_data: JSON containing:
    - ctg: { fhr_baseline, fhr_variability, accelerations, decelerations, contraction_frequency, contraction_intensity, special }
    - vitals: { hr, bp_systolic, bp_diastolic, spo2, temp }
    - labs: { cbc: {...}, chemistry: {...}, coagulation: {...}, other: {...} }
    - abnormal_fields: [field names to highlight in red]
    - patient: { name, age, gravida, para, gestational_weeks, gestational_days, blood_type, allergies, history }

When creating a scenario:
1. Generate a realistic Hebrew case story
2. Create 3-5 progressive cards showing clinical escalation
3. Ensure vital signs and labs change realistically between cards
4. CTG parameters should match the clinical situation
5. Mark abnormal values explicitly in abnormal_fields
6. Patient info goes on card 1 only

Respond in Hebrew when addressed in Hebrew, English when addressed in English.
Output: JSON block with full scenario + cards, plus brief clinical rationale.

Available emergency types: PPH, shoulder dystocia, vacuum delivery, eclampsia/severe HTN, uterine rupture, preterm delivery, fetal bradycardia, maternal cardiac arrest/AFE, placental abruption, cord prolapse.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  let body: { messages: Array<{ role: string; content: string }>; systemPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const systemPrompt = body.systemPrompt ?? SYSTEM_PROMPT_SIMULATOR;

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      stream:     true,
      system:     systemPrompt,
      messages:   body.messages,
    }),
  });

  if (!anthropicResponse.ok) {
    const err = await anthropicResponse.text();
    return Response.json({ error: err }, { status: anthropicResponse.status });
  }

  // Stream the SSE response back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') { controller.close(); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              controller.enqueue(encoder.encode(parsed.delta.text));
            }
          } catch { /* skip malformed lines */ }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
