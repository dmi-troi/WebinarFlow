import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'wf_session';
const PASSWORD_PREFIX = 'scrypt$';
const SESSION_SETTING = 'authSessionHash';

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_PREFIX}${salt}$${derived}`;
}

export function isHashedPassword(value: string) {
  return value.startsWith(PASSWORD_PREFIX);
}

export function verifyPassword(password: string, stored: string): { ok: boolean; needsUpgrade: boolean } {
  if (!stored) return { ok: false, needsUpgrade: false };

  // Backward-compatible path for the existing plaintext password.
  if (!isHashedPassword(stored)) {
    return { ok: password === stored, needsUpgrade: password === stored };
  }

  const [, salt, expectedHex] = stored.split('$');
  if (!salt || !expectedHex) return { ok: false, needsUpgrade: false };
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) return { ok: false, needsUpgrade: false };
  return { ok: timingSafeEqual(actual, expected), needsUpgrade: false };
}

export async function createSession(): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.settings.upsert({
    where: { key: SESSION_SETTING },
    update: { value: sha256(token) },
    create: { key: SESSION_SETTING, value: sha256(token) },
  });
  return token;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function verifyRequest(request: Request): Promise<boolean> {
  const row = await db.settings.findUnique({ where: { key: 'loginPassword' } });
  if (!row?.value) return true;

  const cookie = request.headers.get('cookie') || '';
  const token = cookie.match(/(?:^|;\s*)wf_session=([^;]+)/)?.[1];
  if (!token) return false;

  const session = await db.settings.findUnique({ where: { key: SESSION_SETTING } });
  if (session?.value && sha256(token) === session.value) return true;

  // Compatibility with the old 64-char session cookie until the user logs in once.
  if (!isHashedPassword(row.value) && token === sha256(row.value + '_salt_wf')) return true;
  return false;
}

export async function requireAuth(request: Request): Promise<NextResponse | null> {
  const ok = await verifyRequest(request);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export function withAuth<T extends (request: Request) => Promise<Response> | Response>(handler: T) {
  return async (request: Request) => {
    const denied = await requireAuth(request);
    if (denied) return denied;
    return handler(request);
  };
}
