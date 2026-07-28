import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function hashPassword(pw: string) {
  return createHash('sha256').update(pw).digest('hex');
}

// GET — check if authenticated
export async function GET(req: NextRequest) {
  const row = await db.settings.findUnique({ where: { key: 'loginPassword' } });
  // No password set — set no_password_set cookie so middleware allows requests
  if (!row?.value) {
    const res = NextResponse.json({ authenticated: true, noPassword: true });
    res.cookies.set('wf_session', 'no_password_set', { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/' });
    return res;
  }

  const cookie = req.cookies.get('wf_session');
  if (!cookie?.value) return NextResponse.json({ authenticated: false });

  const valid = cookie.value === hashPassword(row.value + '_salt_wf');
  return NextResponse.json({ authenticated: valid });
}

// POST — login with password (also sets initial password if none exists)
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const row = await db.settings.findUnique({ where: { key: 'loginPassword' } });

  if (!row?.value) {
    // No password configured yet
    if (password) {
      // Set initial password and log in
      await db.settings.upsert({
        where: { key: 'loginPassword' },
        update: { value: password },
        create: { key: 'loginPassword', value: password },
      });
      const res = NextResponse.json({ success: true, passwordSet: true });
      res.cookies.set('wf_session', hashPassword(password + '_salt_wf'), { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
      return res;
    }
    // No password provided, no password needed — issue pass-through cookie
    const res = NextResponse.json({ success: true, noPassword: true });
    res.cookies.set('wf_session', 'no_password_set', { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/' });
    return res;
  }

  if (password !== row.value) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set('wf_session', hashPassword(row.value + '_salt_wf'), { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' });
  return res;
}

// DELETE — logout
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('wf_session', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  return res;
}
