import { NextRequest } from 'next/server';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
  const pusher = getPusherServer();
  if (!pusher) {
    return Response.json({ ok: true, note: 'Pusher not configured — single-device mode' });
  }

  const { sessionCode, event } = await req.json() as { sessionCode: string; event: { type: string; [k: string]: unknown } };
  const channel = `sim-${sessionCode}`;

  await pusher.trigger(channel, event.type, event);
  return Response.json({ ok: true });
}
