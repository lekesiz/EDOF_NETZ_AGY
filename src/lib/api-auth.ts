import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { decryptSession } from './crypto';

export { encryptSession, decryptSession } from './crypto';

/**
 * Hashes a token with SHA-256 (kept for compatibility).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Server-side session validator.
 * In local dev/test or when SKIP_AUTH=true, returns fallback admin.
 */
export async function validateSession(): Promise<string | null> {
  if (process.env.SKIP_AUTH === 'true') {
    return 'admin@netzinformatique.fr';
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('edof_session')?.value;

    if (!sessionToken) {
      return null;
    }

    return decryptSession(sessionToken);
  } catch {
    return null;
  }
}

/**
 * Standard unauthorized API response.
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Non autorisé. Veuillez vous reconnecter.' },
    { status: 401 }
  );
}
