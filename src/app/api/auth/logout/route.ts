import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url);
  
  // Clear cookie by setting maxAge = 0
  response.cookies.set('edof_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });

  return response;
}
