import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { isDbConfigured, sql } from '@/lib/db';
import { signToken, comparePassword, hashPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { runAuthMigrations, seedAdminIfEmpty } from '@/lib/db-migrations';

export async function POST(req: NextRequest) {
  // Rate limit by IP (10 login attempts per minute)
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 10, 60 * 1000)) {
    return Response.json({ error: 'too many login attempts, try again later' }, { status: 429 });
  }

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
      await runAuthMigrations();

      await seedAdminIfEmpty();

      const result = await sql`
        SELECT * FROM sim_users
        WHERE (username = ${username.trim()} OR email = ${username.trim()})
          AND approved = TRUE AND deactivated = FALSE
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
