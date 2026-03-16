import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json() as { token: string; password: string };

  if (!token || !password) {
    return Response.json({ error: 'נתונים חסרים' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return Response.json({ error: 'מסד נתונים לא מוגדר' }, { status: 503 });
  }

  const result = await sql`
    SELECT id, reset_token_expires FROM sim_users
    WHERE reset_token = ${token}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    return Response.json({ error: 'קישור לא תקין' }, { status: 400 });
  }

  const row = result.rows[0] as { id: number; reset_token_expires: string };
  if (new Date(row.reset_token_expires) < new Date()) {
    return Response.json({ error: 'הקישור פג תוקף — יש לבקש איפוס חדש' }, { status: 400 });
  }

  const hash = await hashPassword(password);
  await sql`
    UPDATE sim_users
    SET password_hash = ${hash}, reset_token = NULL, reset_token_expires = NULL
    WHERE id = ${row.id}
  `;

  return Response.json({ ok: true });
}
