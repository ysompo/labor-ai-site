import { sql } from '@vercel/postgres';
import { comparePassword, signToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Check database configuration
    try {
      await sql`SELECT 1`;
    } catch {
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

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

    // Sign JWT token using centralized function
    const token = await signToken({
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      role: user.role,
    });

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
    console.error(
      'Login error:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
