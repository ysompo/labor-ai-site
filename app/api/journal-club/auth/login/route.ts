import { sql } from '@vercel/postgres';
import { SignJWT } from 'jose';
import { comparePassword } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'journal-club-dev-secret'
);

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Missing username or password' },
        { status: 400 }
      );
    }

    // Query sim_users table
    const result = await sql`
      SELECT id, username, password_hash, email, is_admin, role, display_name
      FROM sim_users
      WHERE username = ${username.trim()}
        AND approved = TRUE
        AND deactivated = FALSE
    `;

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Compare password
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Sign JWT token
    const token = await new SignJWT({
      userId: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(SECRET);

    // Set cookie and redirect
    const response = NextResponse.json(
      { success: true, message: 'Logged in successfully' },
      { status: 200 }
    );

    response.cookies.set('sim_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
