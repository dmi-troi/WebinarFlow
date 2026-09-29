import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, clearSessionCookie, hashPassword, setSessionCookie, verifyPassword } from '@/lib/auth';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

function getIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

function isLocked(ip: string) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  attempts.delete(ip);
  return false;
}

function recordFailure(ip: string) {
  const entry = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCKOUT_MS;
  attempts.set(ip, entry);
}

export async function GET(req: NextRequest) {
  const row = await db.settings.findUnique({ where: { key: 'loginPassword' } });
  if (!row?.value) return NextResponse.json({ authenticated: true, noPassword: true });

  const authenticated = await (async () => {
    const token = req.cookies.get('wf_session')?.value;
    if (!token) return false;
    const session = await db.settings.findUnique({ where: { key: 'authSessionHash' } });
    if (session?.value) {
      const { createHash } = await import('node:crypto');
      return createHash('sha256').update(token).digest('hex') === session.value;
    }
    // Compatibility with the old session format while the plaintext password still exists.
    if (row.value.startsWith('scrypt$')) return false;
    const { createHash } = await import('node:crypto');
    return token === createHash('sha256').update(row.value + '_salt_wf').digest('hex');
  })();
  return NextResponse.json({ authenticated });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  if (isLocked(ip)) return NextResponse.json({ error: 'Слишком много неудачных попыток. Попробуйте через 5 минут.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  const row = await db.settings.findUnique({ where: { key: 'loginPassword' } });

  // Preserve the existing first-run behaviour: the first password entered becomes the password.
  if (!row?.value) {
    if (!password) return NextResponse.json({ success: true, noPassword: true });
    const stored = hashPassword(password);
    await db.settings.upsert({ where: { key: 'loginPassword' }, update: { value: stored }, create: { key: 'loginPassword', value: stored } });
    const token = await createSession();
    const response = NextResponse.json({ success: true, passwordSet: true });
    setSessionCookie(response, token);
    return response;
  }

  const result = verifyPassword(password, row.value);
  if (!result.ok) {
    recordFailure(ip);
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  attempts.delete(ip);
  if (result.needsUpgrade) {
    await db.settings.update({ where: { key: 'loginPassword' }, data: { value: hashPassword(password) } });
  }
  const token = await createSession();
  const response = NextResponse.json({ success: true });
  setSessionCookie(response, token);
  return response;
}

export async function DELETE(req: NextRequest) {
  const { requireAuth } = await import('@/lib/auth');
  const denied = await requireAuth(req);
  if (denied) return denied;
  await db.settings.deleteMany({ where: { key: 'authSessionHash' } });
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
