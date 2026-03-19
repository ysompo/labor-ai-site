import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth';

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
             role, display_name, last_active, invite_token IS NOT NULL AS has_pending_invite
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
    const inviteUrl = `${siteOrigin(req)}/tools/simulator/login?invite=${inviteToken}`;
    return Response.json({ ok: true, userId: user.id, username: user.username, inviteUrl });
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
    regenerate_invite?: boolean;
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

    let newInviteUrl: string | undefined;
    if (body.regenerate_invite) {
      const token   = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await sql`
        UPDATE sim_users
        SET invite_token = ${token}, invite_expires = ${expires.toISOString()}
        WHERE id = ${body.id}
      `;
      newInviteUrl = `${siteOrigin(req)}/tools/simulator/login?invite=${token}`;
    }

    return Response.json({ ok: true, ...(newInviteUrl ? { inviteUrl: newInviteUrl } : {}) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
