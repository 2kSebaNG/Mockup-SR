import {
  feedbackMeta,
  GENERIC_ERROR_TEXT,
  mutationErrorText,
  OFFLINE_ERROR_TEXT,
} from '@/lib/abastecimiento/mutation-feedback';

describe('mutationErrorText', () => {
  it('translates a backend message it knows', () => {
    expect(mutationErrorText(new Error('Expense report is already closed'))).toBe(
      'Esta rendición ya está cerrada.',
    );
  });

  it("falls back to the mutation's own text, then to the generic one", () => {
    const unknown = new Error('something odd happened');
    expect(mutationErrorText(unknown, { errorMessage: 'No se pudo cerrar la rendición.' })).toBe(
      'No se pudo cerrar la rendición.',
    );
    expect(mutationErrorText(unknown)).toBe(GENERIC_ERROR_TEXT);
  });

  it('says so when the request never reached the server', () => {
    expect(mutationErrorText(new TypeError('Failed to fetch'))).toBe(OFFLINE_ERROR_TEXT);
    expect(mutationErrorText(new TypeError('Load failed'))).toBe(OFFLINE_ERROR_TEXT);
  });

  it('does not mistake a programming TypeError for a network failure', () => {
    expect(
      mutationErrorText(new TypeError("Cannot read properties of undefined (reading 'x')")),
    ).toBe(GENERIC_ERROR_TEXT);
  });
});

describe('feedbackMeta', () => {
  it('keeps only the fields it knows', () => {
    expect(
      feedbackMeta({ successMessage: 'Listo.', errorMessage: 'Mal.', silent: true, x: 1 }),
    ).toEqual({
      successMessage: 'Listo.',
      errorMessage: 'Mal.',
      silent: true,
    });
  });

  it('copes with no meta or the wrong types', () => {
    expect(feedbackMeta(undefined)).toEqual({});
    expect(feedbackMeta({ successMessage: 3, silent: 'yes' })).toEqual({});
  });
});
