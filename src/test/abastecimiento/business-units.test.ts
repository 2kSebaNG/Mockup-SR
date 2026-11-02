import { hasUnitChoice, unitForNewProject, unitLabel } from '@/lib/abastecimiento/business-units';

describe('the unit a new project is given', () => {
  it('is none when the company has no units, however it is asked', () => {
    expect(unitForNewProject([], '')).toBeUndefined();
    expect(unitForNewProject([], 'ghost')).toBeUndefined();
  });

  it('is the only unit there is, without being asked', () => {
    expect(unitForNewProject([{ id: 'u1' }], '')).toBe('u1');
    expect(unitForNewProject([{ id: 'u1' }], 'u2')).toBe('u1');
  });

  it('is the one picked among several, or none when left as "Sin unidad"', () => {
    const units = [{ id: 'u1' }, { id: 'u2' }];
    expect(unitForNewProject(units, 'u2')).toBe('u2');
    expect(unitForNewProject(units, '')).toBeUndefined();
  });

  it('is none for a unit that is no longer on offer, such as one deactivated after it was picked', () => {
    expect(unitForNewProject([{ id: 'u1' }, { id: 'u2' }], 'u3')).toBeUndefined();
  });
});

describe('whether there is a unit to choose', () => {
  it('is only when there is more than one', () => {
    expect(hasUnitChoice([])).toBe(false);
    expect(hasUnitChoice([{ id: 'u1' }])).toBe(false);
    expect(hasUnitChoice([{ id: 'u1' }, { id: 'u2' }])).toBe(true);
  });
});

describe('the label of a project unit', () => {
  it('is its name, or a dash for a project that has none', () => {
    expect(unitLabel('Ejecución')).toBe('Ejecución');
    expect(unitLabel(null)).toBe('—');
    expect(unitLabel(undefined)).toBe('—');
    expect(unitLabel('  ')).toBe('—');
  });
});
