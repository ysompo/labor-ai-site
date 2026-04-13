import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, encryptCredentials } from '@/lib/journal-club/auth';

export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT from sim_auth cookie
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let verified;
    try {
      verified = await verifyJWT(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const userId = verified.userId as number;
    const isAdmin = verified.isAdmin as boolean;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Query jc_settings table for HUJI and Resend settings
    const settingsResult = await sql`
      SELECT key, encrypted_value
      FROM jc_settings
      WHERE user_id = ${userId}
        AND key IN ('huji_creds', 'resend_api_key', 'resend_from')
    `;

    // Parse settings
    const settings: Record<string, string> = {};
    for (const row of settingsResult.rows) {
      settings[row.key] = row.encrypted_value;
    }

    // Extract HUJI email for masking
    let hujiEmailMasked = '';
    if (settings.huji_creds) {
      try {
        // For security, we don't decrypt the full credentials here
        // Instead, just return a masked version
        // In a real scenario, you might store the email separately
        hujiEmailMasked = '***@huji.ac.il';
      } catch {
        hujiEmailMasked = '***@huji.ac.il';
      }
    }

    return NextResponse.json({
      settings: {
        huji_email_masked: hujiEmailMasked || null,
        resend_api_key: settings.resend_api_key || null,
        resend_from: settings.resend_from || null,
      },
    });
  } catch (error) {
    console.error('Get admin settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extract and verify JWT from sim_auth cookie
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let verified;
    try {
      verified = await verifyJWT(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const userId = verified.userId as number;
    const isAdmin = verified.isAdmin as boolean;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { huji_email, huji_password, resend_api_key, resend_from } = body;

    // Update HUJI credentials if provided
    if (huji_email && huji_password) {
      const encryptedCreds = encryptCredentials(huji_email, huji_password);
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
        VALUES (${userId}, 'huji_creds', ${encryptedCreds}, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET encrypted_value = ${encryptedCreds}, updated_at = NOW()
      `;
    }

    // Update Resend API key if provided
    if (resend_api_key) {
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
        VALUES (${userId}, 'resend_api_key', ${resend_api_key}, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET encrypted_value = ${resend_api_key}, updated_at = NOW()
      `;
    }

    // Update Resend from address if provided
    if (resend_from) {
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
        VALUES (${userId}, 'resend_from', ${resend_from}, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET encrypted_value = ${resend_from}, updated_at = NOW()
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update admin settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
