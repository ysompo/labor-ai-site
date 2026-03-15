import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { SEEDED_SCENARIOS } from '@/lib/simulatorScenarios';

export async function GET() {
  if (!isDbConfigured()) {
    return Response.json({ scenarios: SEEDED_SCENARIOS.map((s, i) => ({ id: i + 1, ...s })) });
  }
  try {
    const scenarios = await sql`SELECT * FROM sim_scenarios ORDER BY id`;
    const cards     = await sql`SELECT * FROM sim_cards ORDER BY scenario_id, card_number`;
    const result = scenarios.rows.map(s => ({
      ...s,
      cards: cards.rows.filter(c => c.scenario_id === s.id),
    }));
    // Fall back to seeded scenarios if DB is empty
    if (result.length === 0) {
      return Response.json({ scenarios: SEEDED_SCENARIOS.map((s, i) => ({ id: i + 1, ...s })) });
    }
    return Response.json({ scenarios: result });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; case_story?: string; expected_actions?: string; phases?: string; cards?: unknown[] };
  if (!isDbConfigured()) {
    return Response.json({ scenario: { id: Date.now(), ...body } });
  }
  try {
    const s = await sql`
      INSERT INTO sim_scenarios (name, case_story, expected_actions, phases)
      VALUES (${body.name}, ${body.case_story ?? ''}, ${body.expected_actions ?? ''}, ${body.phases ?? ''})
      RETURNING *
    `;
    const scenarioId = s.rows[0].id;
    if (Array.isArray(body.cards)) {
      for (const card of body.cards as Array<{ card_number: number; title?: string; clinical_description?: string; structured_data?: unknown }>) {
        await sql`
          INSERT INTO sim_cards (scenario_id, card_number, title, clinical_description, structured_data)
          VALUES (${scenarioId}, ${card.card_number}, ${card.title ?? ''}, ${card.clinical_description ?? ''}, ${JSON.stringify(card.structured_data ?? {})})
        `;
      }
    }
    return Response.json({ scenario: s.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
