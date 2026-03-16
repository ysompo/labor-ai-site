import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isDbConfigured()) {
    return Response.json({ session: { session_code: code, status: 'setup' } });
  }
  try {
    const result = await sql`SELECT * FROM sim_sessions WHERE session_code = ${code}`;
    if (result.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ session: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json() as {
    status?: string;
    current_state?: unknown;
    sim_time_seconds?: number;
  };

  if (!isDbConfigured()) {
    return Response.json({ ok: true });
  }
  try {
    // Ensure state columns exist (safe to run repeatedly)
    if (body.current_state !== undefined) {
      await sql`ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS current_state JSONB`;
      await sql`ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS sim_time_seconds INT DEFAULT 0`;
      await sql`ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS state_saved_at TIMESTAMPTZ DEFAULT NOW()`;
    }

    if (body.status) {
      await sql`UPDATE sim_sessions SET status = ${body.status} WHERE session_code = ${code}`;
    }
    if (body.current_state !== undefined) {
      await sql`
        UPDATE sim_sessions
        SET current_state = ${JSON.stringify(body.current_state)},
            sim_time_seconds = ${body.sim_time_seconds ?? 0},
            state_saved_at = NOW()
        WHERE session_code = ${code}
      `;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
