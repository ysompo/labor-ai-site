// Returns Pusher client config at runtime — used as fallback when
// NEXT_PUBLIC_PUSHER_KEY wasn't available at build time (old bundles).
export async function GET() {
  return Response.json({
    key:     process.env.NEXT_PUBLIC_PUSHER_KEY ?? process.env.PUSHER_KEY ?? '',
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? process.env.PUSHER_CLUSTER ?? 'ap2',
  });
}
