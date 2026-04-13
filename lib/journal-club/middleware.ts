import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

interface JWTPayload {
  isAdmin?: boolean;
  [key: string]: unknown;
}

// Require JWT_SECRET environment variable at startup
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

const SECRET = new TextEncoder().encode(JWT_SECRET);

const PUBLIC_PATHS = ['/tools/journal-club/login'];

export async function withJournalClubAuth(
  request: NextRequest,
  handler: (req: NextRequest, user: JWTPayload | null) => Promise<NextResponse>
) {
  const pathname = request.nextUrl.pathname;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return handler(request, null);
  }

  // Get token from sim_auth cookie
  const token = request.cookies.get('sim_auth')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/tools/journal-club/login', request.url));
  }

  try {
    const verified = await jwtVerify(token, SECRET);
    return handler(request, verified.payload as JWTPayload);
  } catch {
    return NextResponse.redirect(new URL('/tools/journal-club/login', request.url));
  }
}

/**
 * Middleware for admin-only routes.
 */
export async function withAdminAuth(
  request: NextRequest,
  handler: (req: NextRequest, user: JWTPayload) => Promise<NextResponse>
) {
  // Get token from sim_auth cookie
  const token = request.cookies.get('sim_auth')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const verified = await jwtVerify(token, SECRET);
    const payload = verified.payload as JWTPayload;

    // Check if user is admin
    if (!payload.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return handler(request, payload);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
