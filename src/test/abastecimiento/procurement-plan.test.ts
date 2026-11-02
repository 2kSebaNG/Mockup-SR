import {
  groupByRootAccount,
  newPurchaseOrderLink,
  parsePlanItemsParam,
  pendingItems,
  rootAccountId,
  selectionProblemText,
  startPurchaseOrder,
  statusText,
} from '@/lib/abastecimiento/procurement-plan';

const accounts = [
  { id: 'root-1', parentAccountId: null },
  { id: 'child-1', parentAccountId: 'root-1' },
  { id: 'grandchild-1', parentAccountId: 'child-1' },
  { id: 'root-2', parentAccountId: null },
];

const group = (over: Partial<Parameters<typeof statusText>[0]> = {}) =>
  ({
    groupKey: 'k',
    projectId: 'p',
    chartAccountId: 'child-1',
    itemDescription: 'Item',
    unit: 'un',
    totalQuantity: 1,
    averageUnitPrice: 1,
    totalAmount: 1,
    monthCount: 1,
    ocLinkedCount: 0,
    suggestedVendorId: null,
    suggestedVendorName: null,
    status: 'planificado' as const,
    itemIds: ['i'],
    ...over,
  }) as never;

describe('rootAccountId', () => {
  it('walks up to the account with no parent', () => {
    expect(rootAccountId('grandchild-1', accounts)).toBe('root-1');
    expect(rootAccountId('root-2', accounts)).toBe('root-2');
  });

  it('treats an account missing from the list as its own root', () => {
    expect(rootAccountId('ghost', accounts)).toBe('ghost');
  });

  it('does not loop forever on a cyclic parent chain', () => {
    const cyclic = [
      { id: 'a', parentAccountId: 'b' },
      { id: 'b', parentAccountId: 'a' },
    ];
    expect(rootAccountId('a', cyclic)).toBeDefined();
  });
});

describe('groupByRootAccount', () => {
  it('sums totalAmount per root and nests the item groups under it', () => {
    const groups = [
      group({ chartAccountId: 'grandchild-1', totalAmount: 10 }),
      group({ chartAccountId: 'child-1', totalAmount: 5, itemDescription: 'Other' }),
      group({ chartAccountId: 'root-2', totalAmount: 3, itemDescription: 'Third' }),
    ];

    const result = groupByRootAccount(groups, accounts);

    const root1 = result.find((r) => r.rootAccountId === 'root-1')!;
    expect(root1.totalAmount).toBe(15);
    expect(root1.items).toHaveLength(2);
    const root2 = result.find((r) => r.rootAccountId === 'root-2')!;
    expect(root2.totalAmount).toBe(3);
  });
});

describe('statusText', () => {
  it('shows the fraction for parcial/completo, the plain label otherwise', () => {
    expect(statusText(group({ status: 'planificado' }))).toBe('Planificado');
    expect(statusText(group({ status: 'cotizando' }))).toBe('Cotizando');
    expect(statusText(group({ status: 'parcial', ocLinkedCount: 4, monthCount: 6 }))).toBe(
      '4/6 OC emitidas',
    );
    expect(statusText(group({ status: 'completo', ocLinkedCount: 4, monthCount: 4 }))).toBe(
      '4/4 OC emitidas',
    );
  });
});

const row = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    projectId: 'p',
    chartAccountId: 'acc-1',
    itemDescription: `Ítem ${id}`,
    unit: 'mes',
    quantity: 2,
    unitPrice: 1500,
    period: '2026-05-01',
    vendorId: null,
    linkedPurchaseOrder: null,
    ...over,
  }) as never;

describe('what is left to order', () => {
  it('is the rows of the plan with no purchase order', () => {
    const rows = [
      row('a'),
      row('b', { linkedPurchaseOrder: { id: 'po1', code: 'OC-1', status: 'APPROVED' } }),
      row('c'),
    ];
    expect(pendingItems(rows).map((item: { id: string }) => item.id)).toEqual(['a', 'c']);
  });
});

describe('the link to a new purchase order', () => {
  it('names the project and the rows the order is made of', () => {
    expect(newPurchaseOrderLink('p1', ['a', 'b'])).toBe(
      '/procurement/purchase-orders/new?projectId=p1&planItems=a%2Cb',
    );
    expect(newPurchaseOrderLink('p1', [])).toBe('/procurement/purchase-orders/new?projectId=p1');
  });

  it('is read back as the ids, without blanks or repeats', () => {
    expect(parsePlanItemsParam('a%2Cb'.replace('%2C', ','))).toEqual(['a', 'b']);
    expect(parsePlanItemsParam(' a, ,b,a ')).toEqual(['a', 'b']);
    expect(parsePlanItemsParam(null)).toEqual([]);
    expect(parsePlanItemsParam('')).toEqual([]);
  });
});

describe('starting a purchase order from the plan', () => {
  it('takes the account, a line for each row with the plan quantity and price, and a vendor', () => {
    const items = [row('a', { vendorId: 'v1' }), row('b'), row('x', { chartAccountId: 'acc-2' })];
    expect(startPurchaseOrder(items, ['b', 'a'])).toEqual({
      start: {
        chartAccountId: 'acc-1',
        vendorId: 'v1',
        lines: [
          {
            description: 'Ítem b',
            unit: 'mes',
            quantity: '2',
            unitPrice: '1500',
            procurementPlanItemId: 'b',
          },
          {
            description: 'Ítem a',
            unit: 'mes',
            quantity: '2',
            unitPrice: '1500',
            procurementPlanItemId: 'a',
          },
        ],
      },
    });
  });

  it('suggests no vendor when no row has one', () => {
    const result = startPurchaseOrder([row('a')], ['a']);
    expect('start' in result && result.start.vendorId).toBeNull();
  });

  it('cannot make one order from rows of different accounts', () => {
    const items = [row('a'), row('x', { chartAccountId: 'acc-2' })];
    expect(startPurchaseOrder(items, ['a', 'x'])).toEqual({ problem: 'mixed-accounts' });
  });

  it('says so for rows the plan does not have, and for nothing chosen', () => {
    expect(startPurchaseOrder([row('a')], ['a', 'ghost'])).toEqual({ problem: 'unknown-item' });
    expect(startPurchaseOrder([row('a')], [])).toEqual({ problem: 'empty' });
  });

  it('has words for what is wrong', () => {
    expect(selectionProblemText('mixed-accounts')).toMatch(/misma cuenta/);
    expect(selectionProblemText('unknown-item')).toMatch(/ya no está/);
    expect(selectionProblemText('empty')).toMatch(/al menos un ítem/);
  });
});
