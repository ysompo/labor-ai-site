import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { SEEDED_SCENARIOS } from '@/lib/simulatorScenarios';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json() as {
    cards: Array<{
      card_number: number;
      title?: string;
      clinical_description?: string;
      structured_data?: unknown;
    }>;
  };

  if (!isDbConfigured()) {
    return Response.json({ ok: true, mock: true });
  }

  try {
    // Check the scenario actually exists in the DB
    const check = await sql`SELECT id FROM sim_scenarios WHERE id = ${id}`;
    if (check.rows.length === 0) {
      // Scenario exists only in the seeded JS array — insert it into DB now
      const seeded = SEEDED_SCENARIOS[id - 1];
      if (!seeded) return Response.json({ error: 'Scenario not found' }, { status: 404 });
      await sql`
        INSERT INTO sim_scenarios (id, name, case_story, expected_actions)
        VALUES (${id}, ${seeded.name}, ${(seeded as { case_story?: string }).case_story ?? ''}, ${(seeded as { expected_actions?: string }).expected_actions ?? ''})
        ON CONFLICT (id) DO NOTHING
      `;
      // Advance the sequence so future auto-inserts don't collide
      await sql`SELECT setval(pg_get_serial_sequence('sim_scenarios', 'id'), GREATEST((SELECT MAX(id) FROM sim_scenarios), 1))`;
    }

    // Delete all existing cards for this scenario and re-insert
    await sql`DELETE FROM sim_cards WHERE scenario_id = ${id}`;

    for (const card of body.cards) {
      await sql`
        INSERT INTO sim_cards (scenario_id, card_number, title, clinical_description, structured_data)
        VALUES (
          ${id},
          ${card.card_number},
          ${card.title ?? ''},
          ${card.clinical_description ?? ''},
          ${JSON.stringify(card.structured_data ?? {})}
        )
      `;
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
