import { NextRequest } from 'next/server';
import { isDbConfigured, sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'ysompo@gmail.com';

export async function POST(req: NextRequest) {
  const { username, password, email } = await req.json() as {
    username: string; password: string; email?: string;
  };

  if (!username?.trim() || !password) {
    return Response.json({ error: 'נדרש שם משתמש וסיסמה' }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 });
  }

  let approvalToken = '';

  if (isDbConfigured()) {
    try {
      // Check if username already taken
      const existing = await sql`SELECT id FROM sim_users WHERE username = ${username.trim()}`;
      if (existing.rows.length > 0) {
        return Response.json({ error: 'שם משתמש זה כבר קיים' }, { status: 409 });
      }

      const hash = await hashPassword(password);
      approvalToken = crypto.randomUUID();

      await sql`
        INSERT INTO sim_users (username, password_hash, email, approved, is_admin, approval_token)
        VALUES (${username.trim()}, ${hash}, ${email ?? ''}, FALSE, FALSE, ${approvalToken})
      `;
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  } else {
    // No DB — just send the approval email anyway
    approvalToken = 'no-db';
  }

  // Send approval request email to admin
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const origin = req.headers.get('origin') ?? 'https://laborai.vercel.app';
      const approveUrl = `${origin}/api/simulator/auth/approve?token=${approvalToken}`;

      await resend.emails.send({
        from:    'Labor-AI Simulator <onboarding@resend.dev>',
        to:      [ADMIN_EMAIL],
        subject: `בקשת הרשמה חדשה — ${username.trim()} | Labor-AI Simulator`,
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
            <h2 style="color:#4B2E6A;">בקשת הרשמה חדשה</h2>
            <p>משתמש חדש מבקש גישה לסימולטור Labor-AI:</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0;">
              <tr><td style="padding:8px;color:#6b7280;">שם משתמש</td><td style="padding:8px;font-weight:700;">${username.trim()}</td></tr>
              ${email ? `<tr><td style="padding:8px;color:#6b7280;">מייל</td><td style="padding:8px;">${email}</td></tr>` : ''}
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
    } catch (e) {
      console.error('Approval email error:', e);
    }
  }

  return Response.json({ ok: true });
}
