import { parseAmountInput } from '@/lib/abastecimiento/formula';

function value(input: string): number | null {
  const result = parseAmountInput(input);
  if (!result.ok) throw new Error(`"${input}" failed: ${result.error}`);
  return result.value;
}

function error(input: string): string {
  const result = parseAmountInput(input);
  if (result.ok) throw new Error(`"${input}" should have failed, got ${result.value}`);
  return result.error;
}

describe('a plain amount', () => {
  it('reads whole pesos, with or without thousand separators', () => {
    expect(value('1500000')).toBe(1_500_000);
    expect(value('1.500.000')).toBe(1_500_000);
    expect(value('$ 2.000.000')).toBe(2_000_000);
    expect(value('  42 ')).toBe(42);
  });

  it('reads decimals the Chilean way, and a point or a comma as the separator', () => {
    expect(value('1500,5')).toBe(1500.5);
    expect(value('1,5')).toBe(1.5);
    expect(value('1.5')).toBe(1.5);
    expect(value('12.345,67')).toBe(12_345.67);
  });

  it('reads negatives and zero', () => {
    expect(value('-2.000.000')).toBe(-2_000_000);
    expect(value('-$500')).toBe(-500);
    expect(value('0')).toBe(0);
  });

  it('treats a blank as "no projection", which is not zero', () => {
    expect(value('')).toBeNull();
    expect(value('   ')).toBeNull();
    expect(value('0')).not.toBeNull();
  });

  it('rejects anything that is not a number, saying what to type', () => {
    for (const bad of ['abc', '12abc', '1.2.3', '1500000 pesos', '--5']) {
      expect(error(bad)).toMatch(/Escribe un número/);
    }
  });

  it('rejects an amount the column cannot hold', () => {
    expect(error('1000000000000')).toMatch(/demasiado grande/);
    expect(value('999999999999.99')).toBe(999_999_999_999.99);
  });
});

describe('an operation', () => {
  it('adds, subtracts, multiplies and divides, with the usual precedence', () => {
    expect(value('=1200000+350000')).toBe(1_550_000);
    expect(value('=10-3-2')).toBe(5);
    expect(value('=2+3*4')).toBe(14);
    expect(value('=(10+5)*2000')).toBe(30_000);
    expect(value('=100/8')).toBe(12.5);
    expect(value('=2 * 3')).toBe(6);
  });

  it('reads percentages', () => {
    expect(value('=18%*4500000')).toBe(810_000);
    expect(value('=100+10%')).toBe(100.1);
    expect(value('=50%')).toBe(0.5);
  });

  it('reads signs', () => {
    expect(value('=-5+10')).toBe(5);
    expect(value('=--5')).toBe(5);
    expect(value('=0*-1')).toBe(0);
  });

  it('rounds to cents so floating point noise never reaches the amount', () => {
    expect(value('=0.1+0.2')).toBe(0.3);
    expect(value('=10/3')).toBe(3.33);
  });

  it('evaluates SI, in any case, with nesting', () => {
    expect(value('=SI(500>400; 400; 500)')).toBe(400);
    expect(value('=SI(500<400;400;500)')).toBe(500);
    expect(value('=si(1=1;10;20)')).toBe(10);
    expect(value('=SI(2<>2;1;2)')).toBe(2);
    expect(value('=SI(3>=3;1;2)')).toBe(1);
    expect(value('=SI(3<=2;1;2)')).toBe(2);
    expect(value('=SI(1>2;1;SI(3>2;7;8))')).toBe(7);
    expect(value('=SI(5>3;10*2;1)')).toBe(20);
    expect(value('=SI(10*2>15;1%*1000;0)')).toBe(10);
  });

  it('refuses to divide by zero', () => {
    expect(error('=1/0')).toMatch(/dividir por cero/);
    expect(error('=SI(1>0;5/(2-2);1)')).toMatch(/dividir por cero/);
  });

  it('says what is wrong with a malformed operation', () => {
    expect(error('=')).toMatch(/vacía/);
    expect(error('=1+')).toMatch(/incompleta/);
    expect(error('=(1+2')).toMatch(/paréntesis/);
    expect(error('=1+2)')).toMatch(/Sobra/);
    expect(error('=1+a2')).toMatch(/No conozco/);
    expect(error('=1+$')).toMatch(/No entendí/);
    expect(error('=SI(1;2;3)')).toMatch(/comparar/);
    expect(error('=SI(1>0,2,3)')).toMatch(/punto y coma/);
    expect(error('=SI 1>0')).toMatch(/paréntesis/);
  });

  it('only ever does arithmetic: nothing else is run', () => {
    expect(error('=alert(1)')).toMatch(/No conozco/);
    expect(error('=process.exit()')).toMatch(/No entendí/);
    expect(error('=constructor')).toMatch(/No conozco/);
  });

  it('does not take a yes or a no as an amount', () => {
    expect(error('=1>0')).toMatch(/monto/);
    expect(error('=5>3+1')).toMatch(/monto/);
    expect(error('=(1>0)+1')).toMatch(/solo sirve dentro de SI/);
  });

  it('asks for numbers without thousand separators inside an operation', () => {
    expect(error('=1.500.000+1')).toMatch(/sin puntos de miles/);
    expect(error('=1.500,5+1')).toMatch(/sin puntos de miles/);
  });

  it('rejects a result the column cannot hold', () => {
    expect(error('=10000000000*1000')).toMatch(/demasiado grande/);
  });
});
