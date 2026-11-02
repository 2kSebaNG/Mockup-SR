/** Chilean RUT — cleaning, módulo-11 verifier-digit check, and the live-typing
 * display format ("12.345.678-5"). Same raw-value/display-format split as
 * lib/currency-format.ts's formatCurrencyDigits, so this can be unit tested without
 * a React/DOM test setup. */

/** Strips everything but digits and the verifier letter, uppercasing it.
 * "12.345.678-5" -> "123456785"; "" for empty/garbage input. Caps at 9 characters
 * (an 8-digit body plus its verifier — larger than any real RUT) so a caller can't
 * keep growing the raw value forever by continuing to type. */
export function cleanRut(value: string): string {
  return value
    .replace(/[^0-9kK]/g, '')
    .toUpperCase()
    .slice(0, 9);
}

/** Módulo-11 check digit for a RUT body (the digits before the dash) — weights
 * cycle 2,3,4,5,6,7 from the rightmost digit. Returns '0'-'9', or 'K' for 10. */
export function computeRutVerifier(body: string): string {
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/** True when `value` (formatted or raw) is a structurally valid RUT: an
 * all-digits body with a verifier matching módulo 11. */
export function isValidRut(value: string): boolean {
  const cleaned = cleanRut(value);
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return computeRutVerifier(body) === verifier;
}

/** Live-typing display format: "12.345.678-5" — formats as many digits as given,
 * so it stays correct while someone's still typing. */
export function formatRut(value: string): string {
  const cleaned = cleanRut(value);
  if (!cleaned) return '';
  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1);
  if (!body) return verifier;
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped}-${verifier}`;
}

/** `undefined` while blank (not yet typed, or optional and empty) or once the RUT
 * checks out; an error message otherwise. Same convention as
 * lib/purchase-order.ts's issueDateError/paymentDateError. */
export function rutError(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const cleaned = cleanRut(value);
  if (cleaned.length < 8) return 'RUT incompleto.';
  if (!isValidRut(cleaned)) return 'RUT inválido.';
  return undefined;
}
