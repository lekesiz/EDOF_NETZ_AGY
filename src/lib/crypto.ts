const SESSION_SECRET = process.env.SESSION_SECRET || 'edof-session-secret-default-key-2026';

/**
 * Generates HMAC SHA-256 hash using the Web Crypto API (Edge & Node compatible)
 */
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  // Retrieve subtle interface from modern global crypto object
  const cryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle 
    ? crypto.subtle 
    : (globalThis as any).crypto?.subtle;

  if (!cryptoSubtle) {
    throw new Error('Web Crypto API (subtle) is not available in this environment');
  }

  const key = await cryptoSubtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );

  const signature = await cryptoSubtle.sign(
    'HMAC',
    key,
    messageData
  );

  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Signs a session payload (email + expiration) with HMAC SHA-256
 */
export async function encryptSession(email: string, maxAgeMs: number): Promise<string> {
  const expires = Date.now() + maxAgeMs;
  const data = `${email}|${expires}`;
  const hmac = await hmacSha256(data, SESSION_SECRET);
  return `${data}|${hmac}`;
}

/**
 * Decrypts and verifies a session signature
 */
export async function decryptSession(token: string): Promise<string | null> {
  try {
    const parts = token.split('|');
    if (parts.length !== 3) return null;
    const [email, expiresStr, hmac] = parts;
    const expires = parseInt(expiresStr, 10);
    
    // Check expiration
    if (isNaN(expires) || expires < Date.now()) return null;

    // Verify HMAC signature
    const expectedHmac = await hmacSha256(`${email}|${expiresStr}`, SESSION_SECRET);
      
    if (hmac !== expectedHmac) return null;

    return email;
  } catch {
    return null;
  }
}
