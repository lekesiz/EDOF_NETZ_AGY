import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from '@/lib/crypto';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow bypassing auth in testing/development environments if configured
  if (process.env.SKIP_AUTH === 'true') {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('edof_session')?.value;
  const isAuthed = sessionCookie ? (await decryptSession(sessionCookie)) !== null : false;

  // Route categorization
  const isLoginPath = pathname === '/login';
  const isApiPath = pathname.startsWith('/api/');
  const isWebhookPath = pathname.startsWith('/api/webhook/');
  const isAuthHandlerPath = pathname.startsWith('/api/auth/');
  const isPublicAsset = pathname.includes('.') || pathname.startsWith('/_next/');

  // 1. API Route Protection (exclude webhooks and authentication flows)
  if (isApiPath && !isWebhookPath && !isAuthHandlerPath) {
    if (!isAuthed) {
      return NextResponse.json(
        { error: 'Non autorisé. Veuillez vous connecter.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 2. Frontend Route Protection
  if (!isPublicAsset && !isApiPath) {
    if (!isAuthed && !isLoginPath) {
      // Redirect unauthenticated user to login screen
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthed && isLoginPath) {
      // Redirect authenticated user away from login to homepage
      const homeUrl = new URL('/', request.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
