import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth';
import { Resend } from 'resend';

async function sendInviteEmail(to: string, username: string, inviteUrl: string): Promise<string | null> {
  if (!process.env.RESEND_API_KEY) return 'RESEND_API_KEY לא מוגדר';
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from:    'Labor-AI <noreply@labor-ai.org>',
    to:      [to],
    subject: `הזמנה ל-Labor-AI — ${username}`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <h2 style="color:#4B2E6A;">ברוך הבא ל-Labor-AI</h2>
        <p>שלום <strong>${username}</strong>,</p>
        <p>נוצר עבורך חשבון במערכת Labor-AI. לחץ על הכפתור למטה כדי להגדיר את הסיסמה שלך ולהתחיל:</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#4B2E6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin:16px 0;">
          הגדר סיסמה והתחבר
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          הקישור תקף ל-7 ימים. אם לא ביקשת גישה זו, ניתן להתעלם מהודעה זו.
        </p>
      </div>
    `,
  });
  return error ? error.message : null;
}

function isAdmin(req: NextRequest) {
  return req.headers.get('x-is-admin') === 'true';
}

function siteOrigin(req: NextRequest): string {
  // Prefer explicit env var; fall back to the request's own origin so links
  // work correctly across staging / production without extra configuration.
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    ?? new URL(req.url).origin;
}

// GET /api/simulator/admin/users — list all users
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await sql`
      SELECT id, username, email, is_admin, approved, deactivated,
             role, display_name, last_active, invite_token IS NOT NULL AS has_pending_invite,
             has_jc, has_ra
      FROM sim_users
      ORDER BY id
    `;
    return Response.json({ users: result.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/simulator/admin/users — create/invite a new user
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { username, email, role, display_name } =
    await req.json() as { username: string; email?: string; role?: string; display_name?: string };

  if (!username?.trim()) return Response.json({ error: 'נדרש שם משתמש' }, { status: 400 });
  if (!/^[A-Za-z0-9._-]+$/.test(username.trim())) {
    return Response.json({ error: 'שם המשתמש חייב להכיל אותיות באנגלית בלבד (A-Z, 0-9, ., _, -)' }, { status: 400 });
  }

  const inviteToken   = randomBytes(32).toString('hex');
  const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const tempHash      = await hashPassword(randomBytes(16).toString('hex'));

  try {
    const result = await sql`
      INSERT INTO sim_users (username, email, password_hash, approved, is_admin, role, display_name, invite_token, invite_expires)
      VALUES (
        ${username.trim()},
        ${email?.trim() ?? null},
        ${tempHash},
        TRUE,
        FALSE,
        ${role ?? 'trainee'},
        ${display_name?.trim() ?? null},
        ${inviteToken},
        ${inviteExpires.toISOString()}
      )
      RETURNING id, username
    `;
    const user      = result.rows[0];
    const inviteUrl = `${siteOrigin(req)}/login?invite=${inviteToken}`;

    let emailSent = false;
    let emailError: string | undefined;
    if (email?.trim()) {
      const err = await sendInviteEmail(email.trim(), username.trim(), inviteUrl);
      if (err) emailError = err; else emailSent = true;
    }

    return Response.json({ ok: true, userId: user.id, username: user.username, inviteUrl, emailSent, emailError });
  } catch (e: unknown) {
    const msg = String(e);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return Response.json({ error: 'שם המשתמש כבר קיים' }, { status: 409 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/simulator/admin/users — update role, deactivate, regenerate invite
export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    id: number;
    role?: string;
    display_name?: string;
    deactivated?: boolean;
    has_jc?: boolean;
    has_ra?: boolean;
    regenerate_invite?: boolean;
    send_invite_email?: boolean;
    approve?: boolean;
    clear_invite?: boolean;
  };

  if (!body.id) return Response.json({ error: 'נדרש id' }, { status: 400 });

  try {
    // Batch field updates in a single query
    if (body.role !== undefined && body.display_name !== undefined && body.deactivated !== undefined) {
      await sql`UPDATE sim_users SET role = ${body.role}, display_name = ${body.display_name}, deactivated = ${body.deactivated} WHERE id = ${body.id}`;
    } else if (body.role !== undefined && body.display_name !== undefined) {
      await sql`UPDATE sim_users SET role = ${body.role}, display_name = ${body.display_name} WHERE id = ${body.id}`;
    } else if (body.role !== undefined && body.deactivated !== undefined) {
      await sql`UPDATE sim_users SET role = ${body.role}, deactivated = ${body.deactivated} WHERE id = ${body.id}`;
    } else if (body.display_name !== undefined && body.deactivated !== undefined) {
      await sql`UPDATE sim_users SET display_name = ${body.display_name}, deactivated = ${body.deactivated} WHERE id = ${body.id}`;
    } else if (body.role !== undefined) {
      await sql`UPDATE sim_users SET role = ${body.role} WHERE id = ${body.id}`;
    } else if (body.display_name !== undefined) {
      await sql`UPDATE sim_users SET display_name = ${body.display_name} WHERE id = ${body.id}`;
    } else if (body.deactivated !== undefined) {
      await sql`UPDATE sim_users SET deactivated = ${body.deactivated} WHERE id = ${body.id}`;
    }

    if (body.has_jc !== undefined) {
      await sql`UPDATE sim_users SET has_jc = ${body.has_jc} WHERE id = ${body.id}`;
    }
    if (body.has_ra !== undefined) {
      await sql`UPDATE sim_users SET has_ra = ${body.has_ra} WHERE id = ${body.id}`;
    }

    if (body.approve) {
      await sql`UPDATE sim_users SET approved = TRUE, approval_token = NULL WHERE id = ${body.id}`;
      // Send approval notification to the user
      if (process.env.RESEND_API_KEY) {
        const userRow = await sql`SELECT email, username FROM sim_users WHERE id = ${body.id}`;
        const u = userRow.rows[0];
        if (u?.email) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const loginUrl = `${siteOrigin(req)}/tools/simulator/login`;
          await resend.emails.send({
            from: 'Labor-AI Simulator <noreply@labor-ai.org>',
            to:   [u.email],
            subject: 'הגישה שלך אושרה — Labor-AI Simulator',
            html: `
              <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                <h2 style="color:#4B2E6A;">✓ הבקשה שלך אושרה!</h2>
                <p>שלום ${u.username},</p>
                <p>בקשת ההרשמה שלך לסימולטור Labor-AI אושרה. תוכל להתחבר כעת עם שם המשתמש והסיסמה שבחרת.</p>
                <a href="${loginUrl}" style="display:inline-block;background:#4B2E6A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin-top:8px;">
                  כניסה למערכת
                </a>
              </div>
            `,
          });
        }
      }
    }

    if (body.clear_invite) {
      await sql`UPDATE sim_users SET invite_token = NULL, invite_expires = NULL WHERE id = ${body.id}`;
    }

    let newInviteUrl: string | undefined;
    if (body.regenerate_invite) {
      const token   = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await sql`
        UPDATE sim_users
        SET invite_token = ${token}, invite_expires = ${expires.toISOString()}
        WHERE id = ${body.id}
      `;
      newInviteUrl = `${siteOrigin(req)}/login?invite=${token}`;
    }

    let emailSent = false, emailError: string | undefined;
    if (body.send_invite_email && newInviteUrl) {
      const userRow = await sql`SELECT email, username FROM sim_users WHERE id = ${body.id}`;
      const u = userRow.rows[0];
      if (u?.email) {
        const err = await sendInviteEmail(u.email, u.username, newInviteUrl);
        if (err) emailError = err; else emailSent = true;
      } else {
        emailError = 'אין כתובת מייל למשתמש זה';
      }
    }

    return Response.json({ ok: true, ...(newInviteUrl ? { inviteUrl: newInviteUrl } : {}), emailSent, emailError });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
