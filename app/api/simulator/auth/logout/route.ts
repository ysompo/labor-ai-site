import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('sim_auth');
  return Response.json({ ok: true });
}
