import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { isDbConfigured, sql } from '@/lib/db';
import { signToken, comparePassword, hashPassword } from '@/lib/auth';

async function runMigrations() {
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'trainee'`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS deactivated BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS invite_token VARCHAR(100)`;
  await sql`ALTER TABLE sim_users ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMPTZ`;
  // Seed admin gets physician_instructor role
  await sql`UPDATE sim_users SET role = 'physician_instructor' WHERE is_admin = TRUE AND role = 'trainee'`;
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username: string; password: string };
  if (!username?.trim() || !password) {
    return Response.json({ error: 'נדרש שם משתמש וסיסמה' }, { status: 400 });
  }

  let userId: number;
  let isAdmin = false;
  let role = 'trainee';

  if (!isDbConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  } else {
    try {
      await runMigrations();

      // Seed admin on first ever login
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
        WHERE username = ${username.trim()} AND approved = TRUE AND deactivated = FALSE
      `;
      const user = result.rows[0];
      if (!user) return Response.json({ error: 'שם משתמש לא קיים או טרם אושר' }, { status: 401 });

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) return Response.json({ error: 'שם משתמש או סיסמה שגויים' }, { status: 401 });

      userId  = user.id;
      isAdmin = user.is_admin;
      role    = user.role ?? 'trainee';

      // Update last_active
      await sql`UPDATE sim_users SET last_active = NOW() WHERE id = ${userId}`;
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  const token = await signToken({ userId, username: username.trim(), isAdmin, role });
  const cookieStore = await cookies();

  // httpOnly auth cookie
  cookieStore.set('sim_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  // Non-httpOnly meta cookie — client-readable for role-based routing
  cookieStore.set('sim_meta', JSON.stringify({ username: username.trim(), isAdmin, role }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return Response.json({ ok: true, username: username.trim(), isAdmin, role });
}
