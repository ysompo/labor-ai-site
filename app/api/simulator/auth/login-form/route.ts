/**
 * Native HTML form-POST login endpoint.
 * Used as the <form action> fallback when JavaScript hasn't hydrated yet
 * (e.g. Safari iOS before JS loads). Sets cookie on redirect response so
 * the browser receives and stores it in a single round-trip.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { signToken, comparePassword, hashPassword } from '@/lib/auth';

const FALLBACK_ADMIN = { id: 1, username: 'ysompo', password: '123456', isAdmin: true };

function errRedirect(req: NextRequest, code: string) {
  return NextResponse.redirect(
    new URL(`/tools/simulator/login?error=${code}`, req.url),
  );
}

export async function POST(req: NextRequest) {
  let username: string;
  let password: string;

  try {
    const fd = await req.formData();
    username = ((fd.get('username') as string) ?? '').trim();
    password = (fd.get('password') as string) ?? '';
  } catch {
    return errRedirect(req, 'parse');
  }

  if (!username || !password) return errRedirect(req, 'missing');

  let userId: number;
  let isAdmin = false;

  if (!isDbConfigured()) {
    if (username === FALLBACK_ADMIN.username && password === FALLBACK_ADMIN.password) {
      userId = FALLBACK_ADMIN.id;
      isAdmin = true;
    } else {
      return errRedirect(req, 'invalid');
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
      if (!user) return errRedirect(req, 'invalid');

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) return errRedirect(req, 'invalid');

      userId  = user.id;
      isAdmin = user.is_admin;
    } catch {
      return errRedirect(req, 'server');
    }
  }

  const token = await signToken({ userId, username, isAdmin });

  // Set cookie directly on the redirect — works on Safari iOS
  const res = NextResponse.redirect(new URL('/tools/simulator', req.url));
  res.cookies.set('sim_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
