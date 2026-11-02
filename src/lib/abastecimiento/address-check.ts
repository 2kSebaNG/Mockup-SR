import type { components } from './api/schema';

export type AddressCheck = components['schemas']['AddressCheck'];

/** The address and comuna a check was asked for. */
export interface AddressToCheck {
  address: string;
  comuna: string;
}

/** What is worth asking the map: a street (a few letters at least) and the comuna it is in. */
export function addressToCheck(address: string, comuna: string): AddressToCheck | null {
  const street = address.trim();
  const place = comuna.trim();
  return street.length >= 3 && place.length >= 2 ? { address: street, comuna: place } : null;
}

export function sameAddress(a: AddressToCheck | null, b: AddressToCheck | null): boolean {
  return a !== null && b !== null && a.address === b.address && a.comuna === b.comuna;
}

export interface AddressCheckNote {
  /** `ok` is confirmed, `warn` is worth a second look, `muted` is that nothing is known. */
  tone: 'ok' | 'warn' | 'muted';
  text: string;
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** What the check says, in words. It is a warning, never an error: the map does not know every
 * number in Chile. */
export function addressCheckNote(check: AddressCheck, comuna: string): AddressCheckNote {
  switch (check.status) {
    case 'verified':
      return {
        tone: 'ok',
        text: check.matched
          ? `Dirección encontrada en el mapa: ${check.matched}.`
          : `Dirección encontrada en ${comuna}.`,
      };
    case 'number_not_found':
      return {
        tone: 'warn',
        text: `Encontré la calle en ${comuna}, pero no ese número. Puede que el mapa no lo tenga: revísalo.`,
      };
    case 'other_comuna':
      return {
        tone: 'warn',
        text:
          check.foundComunas.length > 0
            ? `No encontré esa calle en ${comuna}; sí en ${list(check.foundComunas)}. ¿La comuna es la correcta?`
            : `No encontré esa calle en ${comuna}. ¿La comuna es la correcta?`,
      };
    case 'not_found':
      return {
        tone: 'warn',
        text: `No encontré esa dirección en ${comuna}. Revisa la calle y la comuna (el mapa no las conoce todas).`,
      };
    case 'unavailable':
      return { tone: 'muted', text: 'No se pudo verificar la dirección ahora.' };
  }
}

/** Fewer letters than this match half the streets of a comuna: nothing is offered yet. */
export const MIN_SUGGEST_LENGTH = 3;

export type AddressSuggestion = components['schemas']['AddressSuggestions']['suggestions'][number];

/** What is typed of the address, to ask for suggestions: null while it is too short. */
export function suggestionQuery(typed: string): string | null {
  const text = typed.trim();
  return text.length >= MIN_SUGGEST_LENGTH ? text : null;
}

/** What goes into the field when a suggestion is picked: a street alone is left open at the end so
 * the number can be typed right away. */
export function pickedAddress(suggestion: AddressSuggestion): string {
  return suggestion.houseNumber ? suggestion.label : `${suggestion.label} `;
}
