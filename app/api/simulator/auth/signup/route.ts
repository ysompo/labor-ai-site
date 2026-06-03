import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { Resend } from 'resend';

// Must match the email registered in the Resend account (test mode restriction)
const ADMIN_EMAIL = 'ysompo@gmail.com';

export async function POST(req: NextRequest) {
  // Rate limit by IP (5 signups per minute)
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(`signup:${ip}`, 5, 60 * 1000)) {
    return Response.json({ error: 'too many signup attempts, try again later' }, { status: 429 });
  }

  const { username, password, email } = await req.json() as {
    username: string; password: string; email: string;
  };

  if (!username?.trim() || !password) {
    return Response.json({ error: 'נדרש שם משתמש וסיסמה' }, { status: 400 });
  }
  if (!/^[A-Za-z0-9._-]+$/.test(username.trim())) {
    return Response.json({ error: 'שם המשתמש חייב להכיל אותיות באנגלית בלבד (A-Z, 0-9, ., _, -)' }, { status: 400 });
  }
  if (!email?.trim()) {
    return Response.json({ error: 'נדרשת כתובת מייל' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 });
  }

  let approvalToken = '';

  if (isDbConfigured()) {
    try {
      const existing = await sql`SELECT id FROM sim_users WHERE username = ${username.trim()}`;
      if (existing.rows.length > 0) {
        return Response.json({ error: 'שם משתמש זה כבר קיים' }, { status: 409 });
      }

      const existingEmail = await sql`SELECT id FROM sim_users WHERE email = ${email.trim().toLowerCase()}`;
      if (existingEmail.rows.length > 0) {
        return Response.json({
          error: 'כתובת המייל הזו כבר רשומה במערכת. ניתן לשחזר סיסמה מדף הכניסה.',
          code: 'email_exists',
        }, { status: 409 });
      }

      const hash = await hashPassword(password);
      approvalToken = crypto.randomUUID();

      await sql`
        INSERT INTO sim_users (username, password_hash, email, approved, is_admin, approval_token)
        VALUES (${username.trim()}, ${hash}, ${email.trim().toLowerCase()}, FALSE, FALSE, ${approvalToken})
      `;
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  } else {
    approvalToken = 'no-db';
  }

  // Send approval request email to admin
  if (!process.env.RESEND_API_KEY) {
    return Response.json({ ok: true, emailWarning: 'RESEND_API_KEY לא מוגדר — המייל לא נשלח' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const origin = req.headers.get('origin') ?? 'https://laborai.vercel.app';
  const approveUrl = `${origin}/api/simulator/auth/approve?token=${approvalToken}`;

  const { error: resendError } = await resend.emails.send({
    from:    'Labor-AI Simulator <noreply@labor-ai.org>',
    to:      [ADMIN_EMAIL],
    subject: `בקשת הרשמה חדשה — ${username.trim()} | Labor-AI Simulator`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2 style="color:#4B2E6A;">בקשת הרשמה חדשה</h2>
        <p>משתמש חדש מבקש גישה לסימולטור Labor-AI:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;color:#6b7280;">שם משתמש</td><td style="padding:8px;font-weight:700;">${username.trim()}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;">מייל</td><td style="padding:8px;">${email.trim().toLowerCase()}</td></tr>
        </table>
        <a href="${approveUrl}" style="display:inline-block;background:#4B2E6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
          ✓ אשר משתמש
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          לחיצה על הכפתור תאשר את הגישה למשתמש זה אוטומטית.
        </p>
      </div>
    `,
  });

  if (resendError) {
    console.error('Approval email error:', resendError);
    // User is saved but email failed — return warning so UI can show it
    return Response.json({ ok: true, emailWarning: `המשתמש נשמר אך שליחת המייל נכשלה: ${resendError.message}` });
  }

  return Response.json({ ok: true });
}
