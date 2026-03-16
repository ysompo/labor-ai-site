'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDbConfigured, sql } from '@/lib/db';
import { signToken, comparePassword, hashPassword } from '@/lib/auth';

const FALLBACK_ADMIN = { id: 1, username: 'ysompo', password: '123456', isAdmin: true };

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const username = ((formData.get('username') as string) ?? '').trim();
  const password  = (formData.get('password')  as string) ?? '';

  if (!username || !password) return { error: 'נדרש שם משתמש וסיסמה' };

  let userId: number;
  let isAdmin = false;

  if (!isDbConfigured()) {
    if (username === FALLBACK_ADMIN.username && password === FALLBACK_ADMIN.password) {
      userId  = FALLBACK_ADMIN.id;
      isAdmin = true;
    } else {
      return { error: 'שם משתמש או סיסמה שגויים' };
    }
  } else {
    try {
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
        SELECT * FROM sim_users WHERE username = ${username} AND approved = TRUE
      `;
      const user = result.rows[0];
      if (!user) return { error: 'שם משתמש לא קיים או טרם אושר' };

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) return { error: 'שם משתמש או סיסמה שגויים' };

      userId  = user.id;
      isAdmin = user.is_admin;
    } catch (e) {
      return { error: String(e) };
    }
  }

  const token = await signToken({ userId, username, isAdmin });
  const cookieStore = await cookies();
  cookieStore.set('sim_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  redirect('/tools/simulator');
}
