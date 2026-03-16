import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';

function generateCode(): string {
  const chars = 'ACDEFHJKLMNPRSTUVWXY3456789'; // no 0/O/Q/I/1/B/G/Z (visually ambiguous)
  let code = 'SIM-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET() {
  if (!isDbConfigured()) {
    return Response.json({ sessions: [] });
  }
  try {
    const result = await sql`
      SELECT
        s.*,
        sc.name AS scenario_name
      FROM sim_sessions s
      LEFT JOIN sim_scenarios sc ON sc.id = s.scenario_id
      ORDER BY s.created_at DESC
      LIMIT 50
    `;
    return Response.json({ sessions: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    scenarioId?: number;
    residentName?: string;
    midwifeName?: string;
    seniorDoctorName?: string;
    chargeMidwifeName?: string;
    observers?: string[];
  };

  const sessionCode = generateCode();
  // Pack all participant info into instructor_name as JSON
  const participantsJson = JSON.stringify({
    resident:      body.residentName      ?? '',
    midwife:       body.midwifeName       ?? '',
    senior_doctor: body.seniorDoctorName  ?? '',
    charge_midwife: body.chargeMidwifeName ?? '',
    observers:     body.observers         ?? [],
  });

  if (!isDbConfigured()) {
    return Response.json({
      sessionCode,
      session: { session_code: sessionCode, status: 'setup', instructor_name: participantsJson },
    });
  }

  try {
    const result = await sql`
      INSERT INTO sim_sessions (session_code, scenario_id, instructor_name, status)
      VALUES (${sessionCode}, ${body.scenarioId ?? null}, ${participantsJson}, 'setup')
      RETURNING *
    `;
    return Response.json({ sessionCode, session: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
