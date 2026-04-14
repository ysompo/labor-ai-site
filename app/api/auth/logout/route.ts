import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('sim_auth');
  cookieStore.delete('sim_meta');
  return Response.json({ ok: true });
}
