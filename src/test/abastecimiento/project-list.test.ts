import { parseProjectStatus, projectSpan, unitPatch } from '@/lib/abastecimiento/project-list';

describe('parseProjectStatus', () => {
  it('knows the three states and nothing else', () => {
    expect(parseProjectStatus('ACTIVE')).toBe('ACTIVE');
    expect(parseProjectStatus('CLOSING')).toBe('CLOSING');
    expect(parseProjectStatus('CLOSED')).toBe('CLOSED');
    expect(parseProjectStatus('')).toBeUndefined();
    expect(parseProjectStatus('active')).toBeUndefined();
    expect(parseProjectStatus('whatever')).toBeUndefined();
  });
});

describe('projectSpan', () => {
  const fmt = (date: string) => `<${date}>`;

  it('shows both dates', () => {
    expect(projectSpan('2026-01-01', '2026-12-31', fmt)).toBe('<2026-01-01> — <2026-12-31>');
  });

  it('shows a dash for the one that is missing, and a single dash for neither', () => {
    expect(projectSpan('2026-01-01', null, fmt)).toBe('<2026-01-01> — —');
    expect(projectSpan(null, '2026-12-31', fmt)).toBe('— — <2026-12-31>');
    expect(projectSpan(null, undefined, fmt)).toBe('—');
  });
});

describe('unitPatch', () => {
  it('is null for "Sin unidad" and the id otherwise', () => {
    expect(unitPatch('')).toBeNull();
    expect(unitPatch('u1')).toBe('u1');
  });
});
