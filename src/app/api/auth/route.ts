import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(pw: string) {
  return createHash('sha256').update(pw).digest('hex');
}

// GET — check if authenticated
export async function GET(req: NextRequest) {
  const row = await prisma.settings.findUnique({ where: { key: 'loginPassword' } });
  // No password set — always allow
  if (!row?.value) return NextResponse.json({ authenticated: true, noPassword: true });

  const cookie = req.cookies.get('wf_session');
  if (!cookie?.value) return NextResponse.json({ authenticated: false });

  const valid = cookie.value === hashPassword(row.value + '_salt_wf');
  return NextResponse.json({ authenticated: valid });
}

// POST — login with password
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const row = await prisma.settings.findUnique({ where: { key: 'loginPassword' } });

  if (!row?.value) {
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