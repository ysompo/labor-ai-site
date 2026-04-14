'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDbConfigured, sql } from '@/lib/db';
import { signToken, comparePassword, hashPassword } from '@/lib/auth';
import { runAuthMigrations, seedAdminIfEmpty } from '@/lib/db-migrations';

const FALLBACK_ADMIN = {
  id: 1, username: 'ysompo', password: '123456',
  isAdmin: true, role: 'physician_instructor',
};

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const username   = ((formData.get('username') as string) ?? '').trim();
  const password   =  (formData.get('password') as string) ?? '';
  const redirectTo =  (formData.get('redirect') as string) ?? '';

  if (!username || !password) return { error: 'נדרש שם משתמש וסיסמה' };

  let userId: number;
  let isAdmin = false;
  let role    = 'trainee';

  if (!isDbConfigured()) {
    if (username === FALLBACK_ADMIN.username && password === FALLBACK_ADMIN.password) {
      userId  = FALLBACK_ADMIN.id;
      isAdmin = true;
      role    = FALLBACK_ADMIN.role;
    } else {
      return { error: 'שם משתמש או סיסמה שגויים' };
    }
  } else {
    try {
      await runAuthMigrations();
      await seedAdminIfEmpty();

      const result = await sql`
        SELECT * FROM sim_users
        WHERE username = ${username} AND approved = TRUE AND deactivated = FALSE
      `;
      const user = result.rows[0];
      if (!user) return { error: 'שם משתמש לא קיים או טרם אושר' };

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) return { error: 'שם משתמש או סיסמה שגויים' };

      userId  = user.id;
      isAdmin = user.is_admin;
      role    = user.role ?? 'trainee';

      await sql`UPDATE sim_users SET last_active = NOW() WHERE id = ${userId}`;
    } catch (e) {
      return { error: String(e) };
    }
  }

  const token = await signToken({ userId, username, isAdmin, role });
  const cookieStore = await cookies();

  cookieStore.set('sim_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  cookieStore.set('sim_meta', JSON.stringify({ username, isAdmin, role }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  const dest = redirectTo && redirectTo.startsWith('/')
    ? redirectTo
    : isAdmin ? '/admin/users' : '/';
  redirect(dest);
}
