import {
  REGIONS,
  TERRITORY,
  comunasOf,
  reconcileComuna,
  regionOfComuna,
} from '@/lib/abastecimiento/territory';
import { REGIONS as VENDOR_REGIONS } from '@/lib/abastecimiento/vendors';

/** How many comunas each region has, from the official division (346 in all). */
const OFFICIAL_COUNTS: Record<string, number> = {
  'Arica y Parinacota': 4,
  Tarapacá: 7,
  Antofagasta: 9,
  Atacama: 9,
  Coquimbo: 15,
  Valparaíso: 38,
  'Metropolitana de Santiago': 52,
  "Libertador General Bernardo O'Higgins": 33,
  Maule: 30,
  Ñuble: 21,
  Biobío: 33,
  'La Araucanía': 32,
  'Los Ríos': 12,
  'Los Lagos': 30,
  'Aysén del General Carlos Ibáñez del Campo': 10,
  'Magallanes y de la Antártica Chilena': 11,
};

/** The first two digits of the official code of every comuna of the region. */
const CODE_PREFIX: Record<string, string> = {
  'CL-AP': '15',
  'CL-TA': '01',
  'CL-AN': '02',
  'CL-AT': '03',
  'CL-CO': '04',
  'CL-VS': '05',
  'CL-RM': '13',
  'CL-LI': '06',
  'CL-ML': '07',
  'CL-NB': '16',
  'CL-BI': '08',
  'CL-AR': '09',
  'CL-LR': '14',
  'CL-LL': '10',
  'CL-AI': '11',
  'CL-MA': '12',
};

describe('the territory of Chile', () => {
  it('has the 16 regions with the names the vendor form already used, north to south', () => {
    expect(TERRITORY.map((region) => region.name)).toEqual(Object.keys(OFFICIAL_COUNTS));
    expect(REGIONS).toEqual(VENDOR_REGIONS);
    expect(REGIONS).toHaveLength(16);
  });

  it('has the official number of comunas in each region, 346 in all', () => {
    for (const region of TERRITORY) {
      expect([region.name, region.comunas.length]).toEqual([
        region.name,
        OFFICIAL_COUNTS[region.name],
      ]);
    }
    expect(TERRITORY.reduce((sum, region) => sum + region.comunas.length, 0)).toBe(346);
  });

  it('gives every comuna a unique five-digit code that starts with its region', () => {
    const codes = TERRITORY.flatMap((region) =>
      region.comunas.map((comuna) => {
        expect(comuna.code).toMatch(/^\d{5}$/);
        expect(comuna.code.startsWith(CODE_PREFIX[region.iso]!)).toBe(true);
        return comuna.code;
      }),
    );
    expect(new Set(codes).size).toBe(346);
  });

  it('does not repeat the name of a comuna, so a name says which one it is', () => {
    const names = TERRITORY.flatMap((region) => region.comunas.map((comuna) => comuna.name));
    expect(new Set(names).size).toBe(346);
  });

  it('lists the comunas of each region alphabetically, ignoring accents', () => {
    for (const region of TERRITORY) {
      const names = region.comunas.map((comuna) => comuna.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es')));
    }
  });

  it('has no blank, padded or damaged names', () => {
    for (const region of TERRITORY) {
      for (const comuna of region.comunas) {
        expect(comuna.name).toBe(comuna.name.trim());
        expect(comuna.name.length).toBeGreaterThan(2);
        expect(comuna.name).not.toMatch(/[�]/);
      }
    }
  });

  it('spells right the comunas whose name the source had wrong', () => {
    const all = TERRITORY.flatMap((region) => region.comunas.map((comuna) => comuna.name));
    for (const right of ['Paihuano', 'Rinconada', 'Marchigüe', 'Ránquil', 'San Nicolás']) {
      expect(all).toContain(right);
    }
    for (const wrong of ['Paiguano', 'Riconada', 'Marichihue', 'Ránqui', 'San Nico']) {
      expect(all).not.toContain(wrong);
    }
  });

  it('knows the comunas people look for, each in its region', () => {
    expect(regionOfComuna('Santiago')).toBe('Metropolitana de Santiago');
    expect(regionOfComuna('Viña del Mar')).toBe('Valparaíso');
    expect(regionOfComuna('Ñuñoa')).toBe('Metropolitana de Santiago');
    expect(regionOfComuna('Punta Arenas')).toBe('Magallanes y de la Antártica Chilena');
    expect(regionOfComuna('Chillán')).toBe('Ñuble');
    expect(regionOfComuna('Atlantis')).toBeUndefined();
  });
});

describe('comunasOf', () => {
  it('gives the comunas of a region', () => {
    const arica = comunasOf('Arica y Parinacota');
    expect(arica).toEqual(['Arica', 'Camarones', 'General Lagos', 'Putre']);
    expect(comunasOf('Metropolitana de Santiago')).toHaveLength(52);
  });

  it('gives none for a blank region or one that is not one of the 16', () => {
    expect(comunasOf('')).toEqual([]);
    expect(comunasOf('Región inventada')).toEqual([]);
  });
});

describe('reconcileComuna', () => {
  it('keeps the comuna when it is still in the region', () => {
    expect(reconcileComuna('Metropolitana de Santiago', 'Las Condes')).toBe('Las Condes');
  });

  it('drops it when it belongs to another region', () => {
    expect(reconcileComuna('Valparaíso', 'Las Condes')).toBe('');
  });

  it('drops it when the region is cleared, and keeps a blank blank', () => {
    expect(reconcileComuna('', 'Las Condes')).toBe('');
    expect(reconcileComuna('Valparaíso', '')).toBe('');
  });

  it('drops a comuna saved as free text that is not one of the list, once the region is changed', () => {
    expect(reconcileComuna('Metropolitana de Santiago', 'Stgo')).toBe('');
  });
});
