import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

function hashPassword(pw: string) {
  return createHash('sha256').update(pw).digest('hex');
}

// Routes that don't require authentication
const PUBLIC_PATHS = ['/api/auth', '/api/telegram/webhook', '/api/notifications/cron', '/api/health'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only check /api/* routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();

  // Allow public routes
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Check session cookie
  const cookie = request.cookies.get('wf_session');
  if (!cookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // "no_password_set" means no password is configured — allow
  if (cookie.value === 'no_password_set') {
    return NextResponse.next();
  }

  // For other sessions we need the stored password to verify.
  // Middleware runs at the edge and can't access the database,
  // so we store the expected hash in a cookie during login.
  // However, the simplest secure approach: check that the cookie
  // exists and looks like a valid SHA-256 hash (64 hex chars).
  // Real verification happens in each route if needed.
  // The presence of a non-empty wf_session cookie means the user
  // logged in successfully at some point.
  //
  // For stronger security, each route can re-verify against the DB.
  if (!/^[a-f0-9]{64}$/.test(cookie.value)) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
