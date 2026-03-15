import { NextRequest } from 'next/server';
import { getPusherServer } from '@/lib/pusherServer';

export async function POST(req: NextRequest) {
  const pusher = getPusherServer();
  if (!pusher) {
    return Response.json({ error: 'Pusher not configured' }, { status: 503 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId   = params.get('socket_id')!;
  const channelName = params.get('channel_name')!;

  const auth = pusher.authorizeChannel(socketId, channelName, {
    user_id:   socketId,
    user_info: { name: 'Simulator User' },
  });

  return Response.json(auth);
}
