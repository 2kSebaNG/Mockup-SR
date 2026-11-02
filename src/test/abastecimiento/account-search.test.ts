import {
  accountLabel,
  accountRows,
  filterAccounts,
  flattenAccounts,
  normalizeSearch,
  type AccountOption,
} from '@/lib/abastecimiento/account-search';

// Costos directos
//   5.1 Materiales
//   5.2 Arriendo
//     5.2.1 Equipos y Vehículos
//     5.2.2 Inmuebles
//   5.10 Otros
// 4 Ventas
const accounts: AccountOption[] = [
  { id: 'sales', code: '4', name: 'Ventas', parentAccountId: null },
  { id: 'other', code: '5.10', name: 'Otros', parentAccountId: 'costs' },
  { id: 'eq', code: '5.2.1', name: 'Equipos y Vehículos', parentAccountId: 'rent' },
  { id: 'costs', code: '5', name: 'Costos directos', parentAccountId: null },
  { id: 'rent', code: '5.2', name: 'Arriendo', parentAccountId: 'costs' },
  { id: 'mat', code: '5.1', name: 'Materiales', parentAccountId: 'costs' },
  { id: 'real', code: '5.2.2', name: 'Inmuebles', parentAccountId: 'rent' },
];

describe('accountRows', () => {
  it('puts each group before what is under it, siblings in the order of their codes', () => {
    expect(accountRows(accounts).map((row) => row.id)).toEqual([
      'sales',
      'costs',
      'mat',
      'rent',
      'eq',
      'real',
      'other',
    ]);
  });

  it('counts the codes by number, so 5.10 comes after 5.2', () => {
    const rows = accountRows(accounts).filter((row) => row.depth === 1);
    expect(rows.map((row) => row.code)).toEqual(['5.1', '5.2', '5.10']);
  });

  it('says how deep each is, where it is and whether it is a group', () => {
    const rows = accountRows(accounts);
    const equipos = rows.find((row) => row.id === 'eq')!;
    expect(equipos).toMatchObject({
      depth: 2,
      path: 'Costos directos › Arriendo › Equipos y Vehículos',
      isGroup: false,
    });
    expect(rows.find((row) => row.id === 'rent')).toMatchObject({ depth: 1, isGroup: true });
    expect(rows.find((row) => row.id === 'sales')).toMatchObject({ depth: 0, isGroup: false });
  });

  it('takes an account whose parent is not in the list as a root', () => {
    const rows = accountRows([
      { id: 'a', code: '1.1', name: 'A', parentAccountId: 'gone' },
      { id: 'b', code: '1.2', name: 'B', parentAccountId: 'a' },
    ]);
    expect(rows.map((row) => [row.id, row.depth, row.path])).toEqual([
      ['a', 0, 'A'],
      ['b', 1, 'A › B'],
    ]);
  });

  it('copes with an empty list and with accounts that have no code', () => {
    expect(accountRows([])).toEqual([]);
    expect(accountRows([{ id: 'x', name: 'Sin código' }]).map((row) => row.path)).toEqual([
      'Sin código',
    ]);
  });
});

describe('filterAccounts', () => {
  const rows = accountRows(accounts);
  const ids = (query: string) => filterAccounts(rows, query).map((row) => row.id);

  it('is everything, in the order of the tree, when nothing is typed', () => {
    expect(filterAccounts(rows, '')).toBe(rows);
    expect(filterAccounts(rows, '   ')).toBe(rows);
  });

  it('finds by name without caring for accents or capitals', () => {
    expect(ids('vehiculos')).toEqual(['eq']);
    expect(ids('VEHÍCULOS')).toEqual(['eq']);
  });

  it('finds by code', () => {
    expect(ids('5.2.2')).toEqual(['real']);
    // A code prefix finds the group and what is under it.
    expect(ids('5.2')).toEqual(['rent', 'eq', 'real']);
  });

  it('finds a group by its name together with everything under it', () => {
    expect(ids('arriendo')).toEqual(['rent', 'eq', 'real']);
  });

  it('wants every word, wherever each one is in the path', () => {
    expect(ids('arriendo equipos')).toEqual(['eq']);
    expect(ids('costos mater')).toEqual(['mat']);
    expect(ids('arriendo ventas')).toEqual([]);
  });

  it('finds nothing for what is not there', () => {
    expect(ids('zzz')).toEqual([]);
  });
});

describe('the rest', () => {
  it('writes an account with its code', () => {
    expect(accountLabel({ code: '5.2', name: 'Arriendo' })).toBe('5.2 — Arriendo');
    expect(accountLabel({ code: null, name: 'Arriendo' })).toBe('Arriendo');
  });

  it('normalizes what is typed', () => {
    expect(normalizeSearch('  Ñuñoa   Ferretería ')).toBe('nunoa ferreteria');
  });

  it('flattens the accounts of a report with their parent and code', () => {
    expect(
      flattenAccounts([
        {
          chartAccountId: 'g',
          code: '5',
          name: 'Costos',
          parentAccountId: null,
          children: [
            {
              chartAccountId: 'l',
              code: '5.1',
              name: 'Materiales',
              parentAccountId: 'g',
              children: [],
            },
          ],
        },
      ]),
    ).toEqual([
      { id: 'g', code: '5', name: 'Costos', parentAccountId: null },
      { id: 'l', code: '5.1', name: 'Materiales', parentAccountId: 'g' },
    ]);
  });
});
