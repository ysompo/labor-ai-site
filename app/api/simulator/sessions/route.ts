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
    // Keep every session from the last 3 days visible (even ones still missing
    // a resident assessment), on top of the most recent 50 overall — so an
    // evaluator who hasn't written feedback yet doesn't lose the session from
    // the list before they get a chance to go back and grade it.
    const result = await sql`
      SELECT
        s.*,
        sc.name AS scenario_name,
        COUNT(a.id)::int                                  AS assessment_count,
        STRING_AGG(a.form_type, ',' ORDER BY a.submitted_at) AS assessment_form_types
      FROM sim_sessions s
      LEFT JOIN sim_scenarios sc ON sc.id = s.scenario_id
      LEFT JOIN sim_assessments a ON a.session_id = s.id
      WHERE s.id IN (
        SELECT id FROM sim_sessions WHERE created_at > NOW() - INTERVAL '3 days'
        UNION
        SELECT id FROM sim_sessions ORDER BY created_at DESC LIMIT 50
      )
      GROUP BY s.id, sc.name
      ORDER BY s.created_at DESC
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
