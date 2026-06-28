import { NextRequest, NextResponse } from 'next/server';
import { encryptSession } from '@/lib/api-auth';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@netzinformatique.fr';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check credentials
    if (normalizedEmail !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'E-mail or password incorrect' },
        { status: 401 }
      );
    }

    // Generate signed session token (7 days expiry)
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
    const sessionToken = await encryptSession(normalizedEmail, MAX_AGE_MS);

    // Set secure cookie
    const response = NextResponse.json({ success: true, user: normalizedEmail });
    
    response.cookies.set('edof_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE_MS / 1000,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
