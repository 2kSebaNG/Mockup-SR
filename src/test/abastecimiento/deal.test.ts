import {
  awardedAtError,
  clientDealTotals,
  clientLabel,
  closeBlockText,
  dealStatusLabel,
  openProjects,
  projectDatesError,
} from '@/lib/abastecimiento/deal';

function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('awardedAtError', () => {
  it('accepts blank, today and past dates', () => {
    expect(awardedAtError('')).toBeUndefined();
    expect(awardedAtError(daysFromToday(0))).toBeUndefined();
    expect(awardedAtError(daysFromToday(-30))).toBeUndefined();
  });

  it('rejects a future date', () => {
    expect(awardedAtError(daysFromToday(1))).toMatch(/no puede ser futura/);
  });
});

describe('projectDatesError', () => {
  it('is fine when blank, equal or in order', () => {
    expect(projectDatesError('', '2026-12-31')).toBeUndefined();
    expect(projectDatesError('2026-01-01', '')).toBeUndefined();
    expect(projectDatesError('2026-01-01', '2026-01-01')).toBeUndefined();
  });

  it('flags an end before the start', () => {
    expect(projectDatesError('2026-06-01', '2026-01-01')).toMatch(/anterior al inicio/);
  });
});

describe('dealStatusLabel', () => {
  it('words the active status in Spanish', () => {
    expect(dealStatusLabel('ACTIVE')).toBe('Activo');
  });

  it('shows a status it does not know as it comes', () => {
    expect(dealStatusLabel('ON_HOLD')).toBe('ON_HOLD');
  });
});

describe('the projects that keep a deal open', () => {
  it('are the ones not closed yet', () => {
    const projects = [
      { code: 'P1', status: 'CLOSED' },
      { code: 'P2', status: 'CLOSING' },
      { code: 'P3', status: 'ACTIVE' },
    ];
    expect(openProjects(projects).map((project) => project.code)).toEqual(['P2', 'P3']);
  });
});

describe('closeBlockText', () => {
  it('is nothing when every project is closed, or there is none', () => {
    expect(closeBlockText([])).toBeUndefined();
    expect(closeBlockText([{ code: 'P1', status: 'CLOSED' }])).toBeUndefined();
  });

  it('names the project that is still open', () => {
    expect(closeBlockText([{ code: 'P1', status: 'ACTIVE' }])).toBe(
      'Para cerrar el negocio primero hay que cerrar el proyecto P1.',
    );
  });

  it('names every project still open', () => {
    expect(
      closeBlockText([
        { code: 'P1', status: 'ACTIVE' },
        { code: 'P2', status: 'CLOSING' },
        { code: 'P3', status: 'CLOSED' },
      ]),
    ).toBe('Para cerrar el negocio primero hay que cerrar los proyectos P1, P2.');
  });
});

describe('clientDealTotals', () => {
  it('adds up the deals, the open ones, the projects and the value of a client', () => {
    expect(
      clientDealTotals([
        { status: 'ACTIVE', currentValue: 1000, projectCount: 2 },
        { status: 'CLOSED', currentValue: 500, projectCount: 1 },
      ]),
    ).toEqual({ deals: 2, openDeals: 1, projects: 3, value: 1500 });
  });

  it('is all zeros for a client with no deal', () => {
    expect(clientDealTotals([])).toEqual({ deals: 0, openDeals: 0, projects: 0, value: 0 });
  });
});

describe('clientLabel', () => {
  it('is the name, or "Sin cliente" for a deal that has none', () => {
    expect(clientLabel('Sacyr')).toBe('Sacyr');
    expect(clientLabel(null)).toBe('Sin cliente');
    expect(clientLabel(undefined)).toBe('Sin cliente');
    expect(clientLabel('  ')).toBe('Sin cliente');
  });
});

describe('dealStatusLabel for a closed deal', () => {
  it('says Cerrado', () => {
    expect(dealStatusLabel('CLOSED')).toBe('Cerrado');
  });
});
