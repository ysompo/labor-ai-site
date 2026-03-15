import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { getPusherServer } from '@/lib/pusherServer';

export async function GET(req: NextRequest) {
  const sessionCode = req.nextUrl.searchParams.get('sessionCode');
  if (!sessionCode) return Response.json({ error: 'sessionCode required' }, { status: 400 });

  if (!isDbConfigured()) return Response.json({ notes: [] });

  try {
    const result = await sql`
      SELECT n.* FROM sim_notes n
      JOIN sim_sessions s ON s.id = n.session_id
      WHERE s.session_code = ${sessionCode}
      ORDER BY n.sim_time_seconds ASC
    `;
    return Response.json({ notes: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    sessionCode: string;
    simTimeSeconds: number;
    noteType: string;
    tagType?: string;
    content: string;
    phase: string;
    authorName: string;
  };

  const id = `note_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Trigger Pusher event regardless of DB
  const pusher = getPusherServer();
  if (pusher) {
    await pusher.trigger(`presence-sim-${body.sessionCode}`, 'note-added', {
      author: body.authorName, role: 'evaluator',
      text: body.content, simTime: body.simTimeSeconds,
      isQuickTag: body.noteType === 'quick_tag', tagType: body.tagType,
    });
  }

  if (!isDbConfigured()) {
    return Response.json({ note: { id, ...body } });
  }

  try {
    const sessionResult = await sql`SELECT id FROM sim_sessions WHERE session_code = ${body.sessionCode}`;
    if (sessionResult.rows.length === 0) return Response.json({ error: 'Session not found' }, { status: 404 });

    const sessionId = sessionResult.rows[0].id;
    const result = await sql`
      INSERT INTO sim_notes (session_id, sim_time_seconds, note_type, tag_type, content, phase)
      VALUES (${sessionId}, ${body.simTimeSeconds}, ${body.noteType}, ${body.tagType ?? ''}, ${body.content}, ${body.phase})
      RETURNING *
    `;
    return Response.json({ note: result.rows[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
