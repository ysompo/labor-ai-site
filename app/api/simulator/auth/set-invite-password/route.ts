import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { signToken, hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json() as { token: string; password: string };

  if (!token?.trim() || !password || password.length < 6) {
    return Response.json({ error: 'נדרש קוד הזמנה וסיסמה באורך 6 תווים לפחות' }, { status: 400 });
  }

  try {
    const result = await sql`
      SELECT * FROM sim_users
      WHERE invite_token = ${token.trim()}
        AND (invite_expires IS NULL OR invite_expires > NOW())
        AND deactivated = FALSE
    `;
    const user = result.rows[0];
    if (!user) {
      return Response.json({ error: 'קוד הזמנה לא תקין או פג תוקף' }, { status: 400 });
    }

    const hash = await hashPassword(password);
    await sql`
      UPDATE sim_users
      SET password_hash = ${hash},
          invite_token  = NULL,
          invite_expires = NULL,
          approved      = TRUE,
          last_active   = NOW()
      WHERE id = ${user.id}
    `;

    const role    = user.role ?? 'trainee';
    const isAdmin = user.is_admin ?? false;
    const jwtToken = await signToken({ userId: user.id, username: user.username, isAdmin, role });

    const cookieStore = await cookies();
    cookieStore.set('sim_auth', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    cookieStore.set('sim_meta', JSON.stringify({ username: user.username, isAdmin, role }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return Response.json({ ok: true, role, username: user.username });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
