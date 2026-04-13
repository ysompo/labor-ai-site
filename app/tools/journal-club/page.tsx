import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export default async function JournalClubPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sim_auth')?.value;

  if (!token) {
    redirect('/tools/journal-club/login');
  }

  try {
    await verifyToken(token);
  } catch {
    redirect('/tools/journal-club/login');
  }

  redirect('/tools/journal-club/journals');
}
