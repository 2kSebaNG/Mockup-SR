import {
  ORIGINAL_PARAM,
  baselineWord,
  deltaLabel,
  isBaseView,
  paramFor,
  resolveScenario,
} from '@/lib/abastecimiento/scenario-base';

describe('resolveScenario', () => {
  it('shows what the URL asks for', () => {
    expect(resolveScenario('s1', 'base-1')).toBe('s1');
    expect(resolveScenario('s1', null)).toBe('s1');
  });

  it('shows the bare original when asked, even if the project has a base', () => {
    expect(resolveScenario(ORIGINAL_PARAM, 'base-1')).toBe('');
    expect(resolveScenario(ORIGINAL_PARAM, null)).toBe('');
  });

  it('opens on the base when the URL says nothing, and on the original without one', () => {
    expect(resolveScenario(null, 'base-1')).toBe('base-1');
    expect(resolveScenario('', 'base-1')).toBe('base-1');
    expect(resolveScenario(null, null)).toBe('');
  });
});

describe('paramFor', () => {
  it('leaves the URL clean for what is shown by default', () => {
    expect(paramFor('base-1', 'base-1')).toBeNull();
    expect(paramFor('', null)).toBeNull();
  });

  it('names the original when the default is the base, and any other scenario by id', () => {
    expect(paramFor('', 'base-1')).toBe(ORIGINAL_PARAM);
    expect(paramFor('s1', 'base-1')).toBe('s1');
    expect(paramFor('s1', null)).toBe('s1');
  });

  it('round-trips with resolveScenario', () => {
    for (const baseId of [null, 'base-1']) {
      for (const scenarioId of ['', 's1', 'base-1']) {
        expect(resolveScenario(paramFor(scenarioId, baseId), baseId)).toBe(scenarioId);
      }
    }
  });
});

describe('the base view', () => {
  it('is the original and the base, where typing makes a draft', () => {
    expect(isBaseView('', 'base-1')).toBe(true);
    expect(isBaseView('base-1', 'base-1')).toBe(true);
    expect(isBaseView('s1', 'base-1')).toBe(false);
    expect(isBaseView('s1', null)).toBe(false);
  });

  it('is compared with in words that follow whether there is a base', () => {
    expect(baselineWord('base-1')).toBe('base');
    expect(baselineWord(null)).toBe('original');
    expect(deltaLabel('base')).toBe('Δ vs base');
    expect(deltaLabel('original')).toBe('Δ vs original');
  });
});
