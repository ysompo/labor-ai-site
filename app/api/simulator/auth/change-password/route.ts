import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { isDbConfigured, sql } from '@/lib/db';
import { verifyToken, hashPassword, comparePassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json() as {
    currentPassword: string; newPassword: string;
  };

  if (!currentPassword || !newPassword) {
    return Response.json({ error: 'שדות חסרים' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return Response.json({ error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('sim_auth')?.value;
  if (!token) return Response.json({ error: 'לא מחובר' }, { status: 401 });

  const { userId } = await verifyToken(token);

  if (!isDbConfigured()) {
    return Response.json({ error: 'DB לא מוגדר — שינוי סיסמה אינו זמין' }, { status: 503 });
  }

  const result = await sql`SELECT * FROM sim_users WHERE id = ${userId}`;
  const user = result.rows[0];
  if (!user) return Response.json({ error: 'משתמש לא נמצא' }, { status: 404 });

  const valid = await comparePassword(currentPassword, user.password_hash);
  if (!valid) return Response.json({ error: 'הסיסמה הנוכחית שגויה' }, { status: 401 });

  const hash = await hashPassword(newPassword);
  await sql`UPDATE sim_users SET password_hash = ${hash} WHERE id = ${userId}`;

  return Response.json({ ok: true });
}
