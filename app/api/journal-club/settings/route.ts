import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/journal-club/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await verifyJWT(token);
    const userId = verified.userId as number;
    const isAdmin = verified.isAdmin as boolean;

    const [userResult, settingsResult] = await Promise.all([
      sql`SELECT email, name FROM sim_users WHERE id = ${userId}`,
      sql`SELECT key, encrypted_value FROM jc_settings WHERE user_id = ${userId} AND key IN ('email_cc_1', 'email_cc_2')`,
    ]);

    const user = userResult.rows[0];
    const settingsMap: Record<string, string> = {};
    for (const row of settingsResult.rows) {
      settingsMap[row.key] = row.encrypted_value;
    }

    return NextResponse.json({
      email: user?.email ?? null,
      name: user?.name ?? null,
      email_cc_1: settingsMap['email_cc_1'] ?? null,
      email_cc_2: settingsMap['email_cc_2'] ?? null,
      is_admin: isAdmin,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const verified = await verifyJWT(token);
    const userId = verified.userId as number;

    const { email_cc_1, email_cc_2 } = await request.json();

    if (email_cc_1 !== undefined) {
      if (email_cc_1 && !EMAIL_REGEX.test(email_cc_1)) {
        return NextResponse.json({ error: 'Invalid format for CC email 1' }, { status: 400 });
      }
      if (email_cc_1) {
        await sql`
          INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
          VALUES (${userId}, 'email_cc_1', ${email_cc_1}, NOW())
          ON CONFLICT (user_id, key) DO UPDATE SET encrypted_value = ${email_cc_1}, updated_at = NOW()
        `;
      } else {
        await sql`DELETE FROM jc_settings WHERE user_id = ${userId} AND key = 'email_cc_1'`;
      }
    }

    if (email_cc_2 !== undefined) {
      if (email_cc_2 && !EMAIL_REGEX.test(email_cc_2)) {
        return NextResponse.json({ error: 'Invalid format for CC email 2' }, { status: 400 });
      }
      if (email_cc_2) {
        await sql`
          INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
          VALUES (${userId}, 'email_cc_2', ${email_cc_2}, NOW())
          ON CONFLICT (user_id, key) DO UPDATE SET encrypted_value = ${email_cc_2}, updated_at = NOW()
        `;
      } else {
        await sql`DELETE FROM jc_settings WHERE user_id = ${userId} AND key = 'email_cc_2'`;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
