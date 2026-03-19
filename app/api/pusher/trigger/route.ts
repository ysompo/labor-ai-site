import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getPusherServer } from '@/lib/pusherServer';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'labor-ai-simulator-secret-key-change-in-production'
);

export async function POST(req: NextRequest) {
  // Require valid auth — this route is outside the middleware matcher
  const token = req.cookies.get('sim_auth')?.value;
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await jwtVerify(token, SECRET);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return Response.json({ ok: true, note: 'Pusher not configured — single-device mode' });
  }

  const { sessionCode, event } = await req.json() as { sessionCode: string; event: { type: string; [k: string]: unknown } };
  const channel = `sim-${sessionCode}`;

  await pusher.trigger(channel, event.type, event);
  return Response.json({ ok: true });
}
