import Pusher from 'pusher';

let _pusher: Pusher | null = null;

export function getPusherServer(): Pusher | null {
  if (!process.env.PUSHER_APP_ID) return null;
  if (!_pusher) {
    _pusher = new Pusher({
      appId:   process.env.PUSHER_APP_ID!,
      key:     process.env.PUSHER_KEY!,
      secret:  process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER ?? 'eu',
      useTLS:  true,
    });
  }
  return _pusher;
}

export function isPusherConfigured(): boolean {
  return !!process.env.PUSHER_APP_ID;
}
