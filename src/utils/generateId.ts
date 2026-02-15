/**
 * Generate a unique ID string.
 *
 * WHY NOT just use crypto.randomUUID()?
 * crypto.randomUUID() only works in "secure contexts" (HTTPS or localhost).
 * When testing on a phone via your local network IP (http://192.168.x.x),
 * the browser considers it insecure and crypto.randomUUID is undefined.
 *
 * This function tries crypto.randomUUID() first (best quality randomness),
 * and falls back to a manual UUID-v4 generator using crypto.getRandomValues()
 * which works in ALL contexts, including plain HTTP.
 */
export function generateId(): string {
  // crypto.randomUUID is the ideal API but requires HTTPS
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: manually build a UUID v4 using crypto.getRandomValues()
  // which is available in all modern browsers regardless of HTTPS.
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where 'y' is one of [8, 9, a, b]
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant (RFC 4122) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
