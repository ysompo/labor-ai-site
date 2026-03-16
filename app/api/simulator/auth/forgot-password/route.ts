import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string };
  if (!email?.trim()) {
    return Response.json({ error: 'נדרשת כתובת מייל' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return Response.json({ ok: true }); // silently succeed in dev
  }

  // Look up user by email
  const result = await sql`
    SELECT id, username FROM sim_users WHERE email = ${email.trim().toLowerCase()} LIMIT 1
  `;

  // Always return ok — don't reveal whether email exists
  if (result.rows.length === 0) {
    return Response.json({ ok: true });
  }

  const user = result.rows[0] as { id: number; username: string };

  // Generate token (1-hour expiry)
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await sql`
    UPDATE sim_users SET reset_token = ${token}, reset_token_expires = ${expires}
    WHERE id = ${user.id}
  `;

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ ok: true, warn: 'RESEND_API_KEY לא מוגדר' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const origin = req.headers.get('origin') ?? 'https://laborai.vercel.app';
  const resetUrl = `${origin}/tools/simulator/reset-password?token=${token}`;

  await resend.emails.send({
    from: 'Labor-AI Simulator <onboarding@resend.dev>',
    to: [email.trim()],
    subject: 'איפוס סיסמה — Labor-AI Simulator',
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2 style="color:#4B2E6A;">איפוס סיסמה</h2>
        <p>קיבלנו בקשה לאיפוס הסיסמה עבור המשתמש <strong>${user.username}</strong>.</p>
        <p>לחץ על הכפתור הבא לאיפוס הסיסמה (בתוקף לשעה אחת):</p>
        <a href="${resetUrl}" style="display:inline-block;background:#4B2E6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin:16px 0;">
          🔑 אפס סיסמה
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          אם לא ביקשת זאת, ניתן להתעלם ממייל זה.
        </p>
      </div>
    `,
  });

  return Response.json({ ok: true });
}
