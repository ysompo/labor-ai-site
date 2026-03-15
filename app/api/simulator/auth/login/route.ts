import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { isDbConfigured, sql } from '@/lib/db';
import { signToken, comparePassword, hashPassword } from '@/lib/auth';

// Fallback when DB is not configured
const FALLBACK_ADMIN = { id: 1, username: 'ysompo', password: '123456', isAdmin: true };

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username: string; password: string };
  if (!username?.trim() || !password) {
    return Response.json({ error: 'נדרש שם משתמש וסיסמה' }, { status: 400 });
  }

  let userId: number;
  let isAdmin = false;

  if (!isDbConfigured()) {
    if (username === FALLBACK_ADMIN.username && password === FALLBACK_ADMIN.password) {
      userId = FALLBACK_ADMIN.id;
      isAdmin = true;
    } else {
      return Response.json({ error: 'שם משתמש או סיסמה שגויים' }, { status: 401 });
    }
  } else {
    try {
      // Seed admin on first ever login
      const count = await sql`SELECT COUNT(*) AS c FROM sim_users`;
      if (Number(count.rows[0].c) === 0) {
        const hash = await hashPassword('123456');
        await sql`
          INSERT INTO sim_users (username, password_hash, email, approved, is_admin)
          VALUES ('ysompo', ${hash}, 'ysompo@gmail.com', TRUE, TRUE)
          ON CONFLICT (username) DO NOTHING
        `;
      }

      const result = await sql`
        SELECT * FROM sim_users WHERE username = ${username.trim()} AND approved = TRUE
      `;
      const user = result.rows[0];
      if (!user) return Response.json({ error: 'שם משתמש לא קיים או טרם אושר' }, { status: 401 });

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) return Response.json({ error: 'שם משתמש או סיסמה שגויים' }, { status: 401 });

      userId  = user.id;
      isAdmin = user.is_admin;
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  const token = await signToken({ userId, username: username.trim(), isAdmin });
  const cookieStore = await cookies();
  cookieStore.set('sim_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return Response.json({ ok: true, username: username.trim(), isAdmin });
}
