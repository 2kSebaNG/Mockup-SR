import { incomeAccounts } from '@/lib/abastecimiento/sales';

describe('incomeAccounts', () => {
  const accounts = [
    { id: 'sales', kind: 'INCOME' as const, active: true },
    { id: 'old-sales', kind: 'INCOME' as const, active: false },
    { id: 'labor', kind: 'COST' as const, active: true },
    { id: 'no-kind', active: true },
    { id: 'null-kind', kind: null, active: true },
    { id: 'no-active-flag', kind: 'INCOME' as const },
  ];

  it('keeps the active income accounts only', () => {
    expect(incomeAccounts(accounts).map((account) => account.id)).toEqual([
      'sales',
      'no-active-flag',
    ]);
  });

  it('is nothing when there is no income account', () => {
    expect(incomeAccounts([{ kind: 'COST' as const, active: true }])).toEqual([]);
    expect(incomeAccounts([])).toEqual([]);
  });
});
