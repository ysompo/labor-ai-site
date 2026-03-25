'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDbConfigured, sql } from '@/lib/db';
import { signToken, comparePassword, hashPassword } from '@/lib/auth';

const FALLBACK_ADMIN = { id: 1, username: 'ysompo', password: '123456', isAdmin: true, role: 'physician_instructor' };

async function runMigrations() {
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'trainee'`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS deactivated BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS invite_token VARCHAR(100)`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMPTZ`;
  await sql`UPDATE sim_users SET role = 'physician_instructor' WHERE is_admin = TRUE AND role = 'trainee'`;
}

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
      await runMigrations();

      const count = await sql`SELECT COUNT(*) AS c FROM sim_users`;
      if (Number(count.rows[0].c) === 0) {
        const hash = await hashPassword('123456');
        await sql`
          INSERT INTO sim_users (username, password_hash, email, approved, is_admin, role)
          VALUES ('ysompo', ${hash}, 'ysompo@gmail.com', TRUE, TRUE, 'physician_instructor')
          ON CONFLICT (username) DO NOTHING
        `;
      }

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

  // Redirect to original destination or research dashboard
  const dest = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/tools/research';
  redirect(dest);
}
