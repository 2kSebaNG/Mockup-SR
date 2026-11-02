/** The accounts a sale can be booked to: the active income ones. The return, the alerts and the
 * charts tell sales from costs by the kind of each account (the API turns the rest down). */
export function incomeAccounts<T extends { kind?: 'INCOME' | 'COST' | null; active?: boolean }>(
  accounts: T[],
): T[] {
  return accounts.filter((account) => account.kind === 'INCOME' && account.active !== false);
}
