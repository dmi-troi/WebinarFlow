import { NextRequest, NextResponse } from 'next/server';

// Authentication is intentionally enforced inside each protected route handler
// (see src/lib/auth.ts), so a middleware/proxy bypass cannot expose application data.
// Middleware remains only as a cheap first line of defence for API requests.
const PUBLIC_PATHS = ['/api/auth', '/api/telegram/webhook', '/api/notifications/cron', '/api/health'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const cookie = request.cookies.get('wf_session');
  if (!cookie?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
