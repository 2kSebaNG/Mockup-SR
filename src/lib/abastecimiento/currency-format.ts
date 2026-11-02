/** Raw numeric string ("1234500", "-500") -> es-CL grouped display ("1.234.500",
 * "-500") — backs components/ui/currency-input.tsx. Chilean pesos have no practical
 * minor unit (same convention as lib/format.ts's formatAmount), so this only ever
 * groups whole-peso digits, never decimals. Lives in its own file (rather than
 * inside the component) so it can be unit tested without a React/DOM test setup,
 * which this project doesn't otherwise need. */
export function formatCurrencyDigits(raw: string, allowNegative: boolean): string {
  if (!raw) return '';
  const negative = allowNegative && raw.trim().startsWith('-');
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return negative ? '-' : '';
  const grouped = new Intl.NumberFormat('es-CL').format(Number(digits));
  return negative ? `-${grouped}` : grouped;
}
