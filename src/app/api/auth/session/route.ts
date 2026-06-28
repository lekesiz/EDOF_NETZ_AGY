import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    authenticated: true,
    email: 'admin@netzinformatique.fr',
    role: 'admin',
  });
}
