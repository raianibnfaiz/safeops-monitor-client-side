/**
 * Lightweight JWT utilities — decode the payload and check expiry locally.
 * Signature verification is intentionally skipped; that is the backend's job.
 */

export interface JwtPayload {
  sub?: string;       // subject (usually the user id)
  id?: string;
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  exp?: number;       // expiry timestamp in seconds since Unix epoch
  iat?: number;       // issued-at timestamp
  [key: string]: unknown;
}

const CLOCK_SKEW_SECONDS = 30; // tolerate up to 30 s of clock drift between client and server

/**
 * Decode the middle (payload) segment of a JWT string.
 * Returns null when the token is missing, malformed, or not a valid JWT.
 */
export function decodeJwtPayload(jwtToken: string): JwtPayload | null {
  try {
    const jwtSegments = jwtToken.split('.');
    if (jwtSegments.length !== 3) return null;

    // JWT uses Base64url encoding — convert to standard Base64 before decoding
    const base64Payload = jwtSegments[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decodedJson = decodeURIComponent(
      atob(base64Payload)
        .split('')
        .map((char) => '%' + char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );

    return JSON.parse(decodedJson) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true when the JWT's `exp` claim is in the past.
 * Tokens that have no `exp` claim are treated as non-expiring (returns false).
 */
export function isTokenExpired(jwtToken: string): boolean {
  const payload = decodeJwtPayload(jwtToken);
  if (!payload?.exp) return false; // no expiry claim → treat as valid

  const currentUnixTime = Math.floor(Date.now() / 1000);
  return payload.exp < currentUnixTime - CLOCK_SKEW_SECONDS;
}

/**
 * Returns the number of seconds remaining until the token expires.
 * Returns Infinity when there is no `exp` claim.
 * Returns 0 when the token is already expired.
 */
export function secondsUntilTokenExpiry(jwtToken: string): number {
  const payload = decodeJwtPayload(jwtToken);
  if (!payload?.exp) return Infinity;

  const currentUnixTime = Math.floor(Date.now() / 1000);
  const secondsRemaining = payload.exp - currentUnixTime;
  return Math.max(0, secondsRemaining);
}
