/** The banks a payment account can be at, as the API accepts them: chosen from this list, never
 * typed, so the same bank is always written the same way. */
export const BANKS = [
  'Banco de Chile',
  'Banco Estado',
  'Banco Santander',
  'Banco BCI',
  'Scotiabank',
  'Banco Itaú',
  'Banco Security',
  'Banco Falabella',
  'Banco Ripley',
  'Banco Consorcio',
  'Banco BICE',
  'Banco Internacional',
  'Banco BTG Pactual',
  'Coopeuch',
  'Mercado Pago',
  'Tenpo',
] as const;

export function isBank(name: string | null | undefined): boolean {
  return (BANKS as readonly string[]).includes(name ?? '');
}

/** What a bank select offers: the list, and first of all the bank an account already has when it
 * is not on it (saved as free text before), so it still shows until someone picks from the list. */
export function bankChoices(current: string): string[] {
  const bank = current.trim();
  return bank !== '' && !isBank(bank) ? [bank, ...BANKS] : [...BANKS];
}
