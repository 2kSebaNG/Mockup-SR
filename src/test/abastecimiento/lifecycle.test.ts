import {
  STATUS_LABEL,
  needsNote,
  suggestionAction,
  suggestionText,
  triggerText,
  type LifecycleSuggestion,
} from '@/lib/abastecimiento/lifecycle';

const suggestion = (
  rule: LifecycleSuggestion['rule'],
  to: LifecycleSuggestion['to'],
  params: LifecycleSuggestion['params'],
): LifecycleSuggestion => ({ rule, to, severity: 'info', auto: false, params });

describe('suggestionText', () => {
  it('says an end date that passed, with how long ago', () => {
    expect(
      suggestionText(
        suggestion('END_DATE_PASSED', 'CLOSING', { endDate: '2026-10-01', daysAgo: 5 }),
      ),
    ).toBe('La fecha de término (01-10-2026) pasó hace 5 días.');
    expect(
      suggestionText(
        suggestion('END_DATE_PASSED', 'CLOSING', { endDate: '2026-10-05', daysAgo: 1 }),
      ),
    ).toBe('La fecha de término (05-10-2026) pasó hace 1 día.');
  });

  it('says an end date that is near, or today', () => {
    expect(
      suggestionText(
        suggestion('END_DATE_NEAR', 'CLOSING', { endDate: '2026-10-20', daysLeft: 14 }),
      ),
    ).toBe('Faltan 14 días para la fecha de término (20-10-2026).');
    expect(
      suggestionText(
        suggestion('END_DATE_NEAR', 'CLOSING', { endDate: '2026-10-06', daysLeft: 0 }),
      ),
    ).toBe('La fecha de término (06-10-2026) es hoy.');
  });

  it('says how much of the budget is spent, how long it has been quiet and who finished', () => {
    expect(suggestionText(suggestion('BUDGET_CONSUMED', 'CLOSING', { percent: 95 }))).toBe(
      'Lleva gastado el 95% del presupuesto (real + proyectado).',
    );
    expect(suggestionText(suggestion('NO_ACTIVITY', 'CLOSING', { days: 75 }))).toBe(
      'Lleva 75 días sin movimientos.',
    );
    expect(suggestionText(suggestion('ASSIGNMENTS_ENDED', 'CLOSING', { assignments: 3 }))).toBe(
      'Todo el personal asignado (3) ya terminó.',
    );
  });

  it('says there is nothing left pending, and what came after a close', () => {
    expect(suggestionText(suggestion('NOTHING_PENDING', 'CLOSED', { days: 40 }))).toMatch(
      /No quedan órdenes de compra ni rendiciones pendientes y lleva 40 días en cierre/,
    );
    expect(suggestionText(suggestion('ACTIVITY_AFTER_CLOSE', 'ACTIVE', { movements: 1 }))).toBe(
      'Hubo 1 movimiento después del cierre.',
    );
    expect(suggestionText(suggestion('ACTIVITY_AFTER_CLOSE', 'ACTIVE', { movements: 4 }))).toBe(
      'Hubo 4 movimientos después del cierre.',
    );
  });
});

describe('suggestionAction', () => {
  it('names the state it moves to, and reopening as such', () => {
    expect(suggestionAction(suggestion('END_DATE_PASSED', 'CLOSING', {}))).toBe(
      'Pasar a En cierre',
    );
    expect(suggestionAction(suggestion('NOTHING_PENDING', 'CLOSED', {}))).toBe('Pasar a Cerrado');
    expect(suggestionAction(suggestion('ACTIVITY_AFTER_CLOSE', 'ACTIVE', {}))).toBe('Reabrir');
  });
});

describe('triggerText', () => {
  it('says who made a change, or that a rule did', () => {
    expect(triggerText({ trigger: 'MANUAL', changedByName: 'Ana' })).toBe('Ana');
    expect(triggerText({ trigger: 'SUGGESTION', changedByName: 'Ana' })).toBe(
      'Ana, aceptando una sugerencia',
    );
    expect(triggerText({ trigger: 'AUTO', changedByName: null })).toBe('Automático (regla segura)');
  });
});

describe('needsNote', () => {
  it('asks for a note only to reopen what was closed', () => {
    expect(needsNote('CLOSED', 'ACTIVE')).toBe(true);
    expect(needsNote('CLOSED', 'CLOSING')).toBe(true);
    expect(needsNote('ACTIVE', 'CLOSING')).toBe(false);
    expect(needsNote('CLOSING', 'CLOSED')).toBe(false);
  });

  it('has a label for every state', () => {
    expect(Object.keys(STATUS_LABEL).sort()).toEqual(['ACTIVE', 'CLOSED', 'CLOSING']);
  });
});
