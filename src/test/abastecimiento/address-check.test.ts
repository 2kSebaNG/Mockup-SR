import {
  addressCheckNote,
  addressToCheck,
  pickedAddress,
  sameAddress,
  suggestionQuery,
  type AddressCheck,
} from '@/lib/abastecimiento/address-check';

const check = (patch: Partial<AddressCheck>): AddressCheck => ({
  status: 'verified',
  matched: null,
  foundComunas: [],
  ...patch,
});

describe('what is worth asking the map', () => {
  it('needs a street and a comuna, trimmed', () => {
    expect(addressToCheck('  Av. Providencia 1234 ', ' Providencia ')).toEqual({
      address: 'Av. Providencia 1234',
      comuna: 'Providencia',
    });
    expect(addressToCheck('Av', 'Providencia')).toBeNull();
    expect(addressToCheck('Av. Providencia 1234', '')).toBeNull();
    expect(addressToCheck('', '')).toBeNull();
  });

  it('tells whether the question is still the one that was asked', () => {
    const asked = addressToCheck('Av. Providencia 1234', 'Providencia');
    expect(sameAddress(asked, addressToCheck('Av. Providencia 1234 ', 'Providencia'))).toBe(true);
    expect(sameAddress(asked, addressToCheck('Av. Providencia 1235', 'Providencia'))).toBe(false);
    expect(sameAddress(asked, addressToCheck('Av. Providencia 1234', 'Ñuñoa'))).toBe(false);
    expect(sameAddress(asked, null)).toBe(false);
    expect(sameAddress(null, null)).toBe(false);
  });
});

describe('what the check says', () => {
  it('confirms an address found, with how the map has it', () => {
    expect(
      addressCheckNote(check({ matched: 'Avenida Providencia 1234, Providencia' }), 'Providencia'),
    ).toEqual({
      tone: 'ok',
      text: 'Dirección encontrada en el mapa: Avenida Providencia 1234, Providencia.',
    });
    expect(addressCheckNote(check({}), 'Providencia').text).toBe(
      'Dirección encontrada en Providencia.',
    );
  });

  it('warns, without blocking, of a number, a comuna or an address it does not find', () => {
    expect(addressCheckNote(check({ status: 'number_not_found' }), 'Providencia')).toEqual({
      tone: 'warn',
      text: 'Encontré la calle en Providencia, pero no ese número. Puede que el mapa no lo tenga: revísalo.',
    });
    expect(
      addressCheckNote(
        check({ status: 'other_comuna', foundComunas: ['Providencia', 'Santiago', 'Ñuñoa'] }),
        'Puerto Montt',
      ).text,
    ).toBe(
      'No encontré esa calle en Puerto Montt; sí en Providencia, Santiago y Ñuñoa. ¿La comuna es la correcta?',
    );
    expect(
      addressCheckNote(check({ status: 'other_comuna', foundComunas: ['Santiago'] }), 'Maipú').text,
    ).toBe('No encontré esa calle en Maipú; sí en Santiago. ¿La comuna es la correcta?');
    expect(addressCheckNote(check({ status: 'not_found' }), 'Maipú')).toEqual({
      tone: 'warn',
      text: 'No encontré esa dirección en Maipú. Revisa la calle y la comuna (el mapa no las conoce todas).',
    });
  });

  it('says no more than that nothing is known when the map could not be asked', () => {
    expect(addressCheckNote(check({ status: 'unavailable' }), 'Maipú')).toEqual({
      tone: 'muted',
      text: 'No se pudo verificar la dirección ahora.',
    });
  });
});

describe('the suggestions while an address is typed', () => {
  it('asks only once there are a few letters, ignoring the spaces around', () => {
    expect(suggestionQuery('')).toBeNull();
    expect(suggestionQuery(' Av ')).toBeNull();
    expect(suggestionQuery('  Av. Provi ')).toBe('Av. Provi');
  });

  it('leaves a street open for the number, and an address with its number as it is', () => {
    expect(
      pickedAddress({
        label: 'Avenida Providencia',
        street: 'Avenida Providencia',
        houseNumber: null,
      }),
    ).toBe('Avenida Providencia ');
    expect(
      pickedAddress({
        label: 'Avenida Pedro de Valdivia 550',
        street: 'Avenida Pedro de Valdivia',
        houseNumber: '550',
      }),
    ).toBe('Avenida Pedro de Valdivia 550');
  });
});
