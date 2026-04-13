import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, encryptCredentials } from '@/lib/journal-club/auth';

// Settings key constants
const SETTINGS = {
  HUJI_CREDS: 'huji_creds',
  RESEND_API_KEY: 'resend_api_key',
  RESEND_FROM: 'resend_from',
} as const;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HUJI_EMAIL_REGEX = /^[^\s@]+@huji\.ac\.il$/;

/**
 * Verify JWT token from sim_auth cookie
 */
async function verifyAdminToken(token: string | undefined) {
  if (!token) {
    throw new Error('No token');
  }
  try {
    const verified = await verifyJWT(token);
    const isAdmin = verified.isAdmin as boolean;
    if (!isAdmin) {
      throw new Error('Not admin');
    }
    return verified.userId as number;
  } catch {
    throw new Error('Invalid token');
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT from sim_auth cookie
    const token = request.cookies.get('sim_auth')?.value;

    let userId: number;
    try {
      userId = await verifyAdminToken(token);
    } catch (error) {
      if ((error as Error).message === 'Not admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query jc_settings table for HUJI and Resend settings
    const settingsResult = await sql`
      SELECT key
      FROM jc_settings
      WHERE user_id = ${userId}
        AND key IN (${SETTINGS.HUJI_CREDS}, ${SETTINGS.RESEND_API_KEY}, ${SETTINGS.RESEND_FROM})
    `;

    // Check which settings are configured (don't return encrypted values)
    const configuredKeys = new Set(settingsResult.rows.map(row => row.key));

    return NextResponse.json({
      settings: {
        huji_email_masked: configuredKeys.has(SETTINGS.HUJI_CREDS) ? '***@huji.ac.il' : null,
        resend_api_key_set: configuredKeys.has(SETTINGS.RESEND_API_KEY),
        resend_from: configuredKeys.has(SETTINGS.RESEND_FROM) ? '***' : null,
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

    let userId: number;
    try {
      userId = await verifyAdminToken(token);
    } catch (error) {
      if ((error as Error).message === 'Not admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { huji_email, huji_password, resend_api_key, resend_from } = body;

    // Validate and update HUJI credentials if provided
    if (huji_email && huji_password) {
      // Validate HUJI email format
      if (!HUJI_EMAIL_REGEX.test(huji_email)) {
        return NextResponse.json(
          { error: 'Invalid HUJI email format. Must be your.email@huji.ac.il' },
          { status: 400 }
        );
      }

      const encryptedCreds = encryptCredentials(huji_email, huji_password);
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
        VALUES (${userId}, ${SETTINGS.HUJI_CREDS}, ${encryptedCreds}, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET encrypted_value = ${encryptedCreds}, updated_at = NOW()
      `;
    }

    // Validate and update Resend API key if provided
    if (resend_api_key) {
      // Encrypt the API key using email-password format for consistency
      const encryptedKey = encryptCredentials('resend_key', resend_api_key);
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
        VALUES (${userId}, ${SETTINGS.RESEND_API_KEY}, ${encryptedKey}, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET encrypted_value = ${encryptedKey}, updated_at = NOW()
      `;
    }

    // Validate and update Resend from address if provided
    if (resend_from) {
      // Validate email format
      if (!EMAIL_REGEX.test(resend_from)) {
        return NextResponse.json(
          { error: 'Invalid email format for Resend from address' },
          { status: 400 }
        );
      }

      const encryptedFrom = encryptCredentials('resend_from', resend_from);
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value, updated_at)
        VALUES (${userId}, ${SETTINGS.RESEND_FROM}, ${encryptedFrom}, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET encrypted_value = ${encryptedFrom}, updated_at = NOW()
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
