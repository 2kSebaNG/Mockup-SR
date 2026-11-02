/**
 * What a person can type into a projection cell: a plain amount, or an operation that
 * starts with "=" — sums, differences, products, quotients, percentages, the SI conditional
 * and references to other cells of the grid, as in the IC's spreadsheet but without
 * anything complicated:
 *
 *   1500000            1.500.000          1500,5
 *   =1200000+350000    =(10+5)*2000       =18%*4500000
 *   =SI(500>400; 400; 500)
 *   =[Materiales, anterior]*1,05          =[Mano de obra]+[Equipos, real]
 *
 * A reference is a cell's account between square brackets, optionally followed by the
 * month and the figure (see `formula-refs.ts` for what each means). It is read when the
 * cell is saved: the cell keeps the result, not the formula.
 *
 * It is evaluated by a small parser of its own (never `eval`), so what is typed can only
 * ever do arithmetic. `analyzeAmountInput` also says it in words, step by step, which is
 * what the assistant next to the cell shows while typing.
 */
export type AmountResult = { ok: true; value: number | null } | { ok: false; error: string };

/** What a reference to another cell comes back as. */
export type RefResult =
  { ok: true; label: string; value: number | null } | { ok: false; error: string };

/** How a formula reaches the other cells; without it, references are not allowed. */
export interface FormulaContext {
  resolve(reference: string): RefResult;
}

/** What the assistant is told about what was typed, in the order it reads it. */
export type FormulaAnalysis =
  | { kind: 'blank' }
  | { kind: 'amount'; value: number }
  | {
      kind: 'formula';
      value: number;
      /** The calculation in words, one line per operation, the last one being the result. */
      steps: string[];
      /** Things worth knowing that do not stop it, e.g. a referenced cell is empty. */
      warnings: string[];
      /** Every cell it read, as "Cuenta · mes". */
      references: string[];
    }
  | { kind: 'error'; error: string };

/** What the amount column holds: twelve digits before the point, two after. */
const MAX_AMOUNT = 999_999_999_999.99;

export const AMOUNT_HINT =
  'Escribe un número (1500000) o una operación que empiece con = (=1200000+350000).';

/** A blank input means "no projection" (`value: null`), which is not the same as 0. */
export function parseAmountInput(input: string, context?: FormulaContext): AmountResult {
  const analysis = analyzeAmountInput(input, context);
  switch (analysis.kind) {
    case 'blank':
      return { ok: true, value: null };
    case 'error':
      return { ok: false, error: analysis.error };
    default:
      return { ok: true, value: analysis.value };
  }
}

/** Reads what was typed and explains it. Never throws: whatever is wrong comes back as an
 * `error` in plain words. */
export function analyzeAmountInput(input: string, context?: FormulaContext): FormulaAnalysis {
  const text = withoutSpaces(input);
  if (text === '') return { kind: 'blank' };
  if (text.startsWith('=')) return analyzeOperation(text.slice(1), context);

  const plain = text.replace(/^\$/, '').replace(/^(-?)\$/, '$1');
  let normalized: string | null = null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(plain)) {
    // es-CL: dots group thousands, a comma is the decimal separator.
    normalized = plain.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+([.,]\d+)?$/.test(plain)) {
    normalized = plain.replace(',', '.');
  }
  if (normalized === null) return { kind: 'error', error: AMOUNT_HINT };
  const result = finish(Number(normalized));
  return result.ok ? { kind: 'amount', value: result.value } : result;
}

/** Spaces are noise everywhere except inside a reference, where they are part of a name. */
function withoutSpaces(input: string): string {
  let out = '';
  let inReference = false;
  for (const char of input) {
    if (char === '[') inReference = true;
    else if (char === ']') inReference = false;
    if (inReference || !/[\s ]/.test(char)) out += char;
  }
  return out;
}

function finish(
  raw: number,
): { ok: true; value: number } | { ok: false; kind: 'error'; error: string } {
  if (!Number.isFinite(raw) || Math.abs(raw) > MAX_AMOUNT) {
    return { ok: false, kind: 'error', error: 'El monto es demasiado grande.' };
  }
  const value = Math.round(raw * 100) / 100;
  // `-0` would read as a negative zero; a projection of nothing is just 0.
  return { ok: true, value: value === 0 ? 0 : value };
}

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'op'; value: string }
  | { kind: 'name'; value: string; raw: string }
  | { kind: 'ref'; value: string };

class OperationError extends Error {}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    if (/^\d+(\.\d{3}){2,}/.test(rest) || /^\d{1,3}(\.\d{3})+,\d/.test(rest)) {
      throw new OperationError(
        'Dentro de una operación escribe los números sin puntos de miles (1500000).',
      );
    }
    const number = /^\d+([.,]\d+)?/.exec(rest) ?? /^[.,]\d+/.exec(rest);
    if (number) {
      tokens.push({ kind: 'number', value: Number(number[0].replace(',', '.')) });
      i += number[0].length;
      continue;
    }
    if (rest[0] === '[') {
      const close = rest.indexOf(']');
      if (close < 0) throw new OperationError('Falta cerrar el corchete ] de la referencia.');
      tokens.push({ kind: 'ref', value: rest.slice(1, close).trim() });
      i += close + 1;
      continue;
    }
    const name = /^[A-Za-z]+/.exec(rest);
    if (name) {
      tokens.push({ kind: 'name', value: name[0].toUpperCase(), raw: name[0] });
      i += name[0].length;
      continue;
    }
    const op = /^(>=|<=|<>|[-+*/%()<>=;])/.exec(rest);
    if (op) {
      tokens.push({ kind: 'op', value: op[0] });
      i += op[0].length;
      continue;
    }
    throw new OperationError(`No entendí «${rest[0]}» en la operación.`);
  }
  return tokens;
}

type Node =
  | { type: 'number'; value: number }
  | { type: 'ref'; reference: string }
  | { type: 'neg'; operand: Node }
  | { type: 'percent'; operand: Node }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }
  | { type: 'compare'; op: string; left: Node; right: Node }
  | { type: 'if'; condition: Node; whenTrue: Node; whenFalse: Node };

/** Recursive descent over: comparison > sum > product > sign > percent > atom. It only
 * builds the tree; reading it is `Evaluator`'s job. */
class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    if (this.tokens.length === 0) throw new OperationError('La operación está vacía.');
    const node = this.comparison();
    if (this.position < this.tokens.length) {
      throw new OperationError(
        `Sobra «${this.describe(this.tokens[this.position]!)}» en la operación.`,
      );
    }
    return node;
  }

  private describe(token: Token): string {
    if (token.kind === 'number') return String(token.value);
    if (token.kind === 'ref') return `[${token.value}]`;
    return token.value;
  }

  private peekOp(...ops: string[]): string | null {
    const token = this.tokens[this.position];
    return token?.kind === 'op' && ops.includes(token.value) ? token.value : null;
  }

  private comparison(): Node {
    const left = this.sum();
    const op = this.peekOp('>=', '<=', '<>', '>', '<', '=');
    if (!op) return left;
    this.position += 1;
    return { type: 'compare', op, left, right: this.sum() };
  }

  private sum(): Node {
    let left = this.product();
    for (let op = this.peekOp('+', '-'); op; op = this.peekOp('+', '-')) {
      this.position += 1;
      left = { type: 'binary', op: op as '+' | '-', left, right: this.product() };
    }
    return left;
  }

  private product(): Node {
    let left = this.sign();
    for (let op = this.peekOp('*', '/'); op; op = this.peekOp('*', '/')) {
      this.position += 1;
      left = { type: 'binary', op: op as '*' | '/', left, right: this.sign() };
    }
    return left;
  }

  private sign(): Node {
    const op = this.peekOp('-', '+');
    if (!op) return this.percent();
    this.position += 1;
    const operand = this.sign();
    return op === '-' ? { type: 'neg', operand } : operand;
  }

  private percent(): Node {
    let node = this.atom();
    while (this.peekOp('%')) {
      this.position += 1;
      node = { type: 'percent', operand: node };
    }
    return node;
  }

  private atom(): Node {
    const token = this.tokens[this.position];
    if (!token)
      throw new OperationError(
        'La operación está incompleta: falta un número o una referencia al final.',
      );
    if (token.kind === 'number') {
      this.position += 1;
      return { type: 'number', value: token.value };
    }
    if (token.kind === 'ref') {
      this.position += 1;
      return { type: 'ref', reference: token.value };
    }
    if (token.kind === 'op' && token.value === '(') {
      this.position += 1;
      const node = this.comparison();
      this.expect(')', 'Falta cerrar un paréntesis.');
      return node;
    }
    if (token.kind === 'name') {
      if (token.value !== 'SI') {
        throw new OperationError(
          `No conozco «${token.raw}». Solo existe SI(condición; si cumple; si no). ` +
            `Para usar una cuenta escríbela entre corchetes, por ejemplo [${token.raw}].`,
        );
      }
      this.position += 1;
      this.expect('(', 'Después de SI va un paréntesis.');
      const condition = this.comparison();
      this.expect(';', 'En SI, separa con ; (punto y coma).');
      const whenTrue = this.comparison();
      this.expect(';', 'En SI, separa con ; (punto y coma).');
      const whenFalse = this.comparison();
      this.expect(')', 'Falta cerrar el paréntesis de SI.');
      return { type: 'if', condition, whenTrue, whenFalse };
    }
    throw new OperationError(`No entendí «${this.describe(token)}» en la operación.`);
  }

  private expect(op: string, message: string) {
    if (!this.peekOp(op)) throw new OperationError(message);
    this.position += 1;
  }
}

type Value = number | boolean;

const SYMBOL: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** Numbers in the Chilean way, up to two decimals: 1.200.000 and 0,18. */
function figure(value: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value);
}

/** Works the tree out and says what it did, one line per operation. */
class Evaluator {
  readonly steps: string[] = [];
  readonly warnings: string[] = [];
  readonly references: string[] = [];

  constructor(private readonly context: FormulaContext | undefined) {}

  evaluate(node: Node): Value {
    switch (node.type) {
      case 'number':
        return node.value;
      case 'ref':
        return this.reference(node.reference);
      case 'neg': {
        const value = -this.num(this.evaluate(node.operand));
        this.steps.push(`Cambio de signo: ${figure(value)}`);
        return value;
      }
      case 'percent': {
        const operand = this.num(this.evaluate(node.operand));
        const value = operand / 100;
        this.steps.push(`${figure(operand)}% = ${figure(value)}`);
        return value;
      }
      case 'binary':
        return this.binary(node);
      case 'compare':
        return this.compare(node);
      case 'if': {
        const condition = this.evaluate(node.condition);
        if (typeof condition !== 'boolean') {
          throw new OperationError('La condición de SI debe comparar, por ejemplo 500>400.');
        }
        const chosen = condition ? node.whenTrue : node.whenFalse;
        const value = this.evaluate(chosen);
        this.steps.push(
          `${condition ? 'Sí se cumple' : 'No se cumple'}: se usa ${typeof value === 'number' ? figure(value) : value}`,
        );
        return value;
      }
    }
  }

  private reference(text: string): number {
    if (!this.context) {
      throw new OperationError('Aquí no se pueden usar referencias a otras celdas.');
    }
    const result = this.context.resolve(text);
    if (!result.ok) throw new OperationError(result.error);
    if (!this.references.includes(result.label)) this.references.push(result.label);
    if (result.value === null) {
      this.warnings.push(`${result.label} está vacía: cuenta como 0.`);
      this.steps.push(`${result.label} está vacía → 0`);
      return 0;
    }
    this.steps.push(`${result.label} = ${figure(result.value)}`);
    return result.value;
  }

  private binary(node: Extract<Node, { type: 'binary' }>): number {
    const left = this.num(this.evaluate(node.left));
    const right = this.num(this.evaluate(node.right));
    if (node.op === '/' && right === 0) throw new OperationError('No se puede dividir por cero.');
    const value =
      node.op === '+'
        ? left + right
        : node.op === '-'
          ? left - right
          : node.op === '*'
            ? left * right
            : left / right;
    this.steps.push(`${figure(left)} ${SYMBOL[node.op]} ${figure(right)} = ${figure(value)}`);
    return value;
  }

  private compare(node: Extract<Node, { type: 'compare' }>): boolean {
    const a = this.num(this.evaluate(node.left));
    const b = this.num(this.evaluate(node.right));
    let result: boolean;
    switch (node.op) {
      case '>=':
        result = a >= b;
        break;
      case '<=':
        result = a <= b;
        break;
      case '<>':
        result = a !== b;
        break;
      case '>':
        result = a > b;
        break;
      case '<':
        result = a < b;
        break;
      default:
        result = a === b;
    }
    this.steps.push(`¿${figure(a)} ${node.op} ${figure(b)}? ${result ? 'Sí' : 'No'}`);
    return result;
  }

  private num(value: Value): number {
    if (typeof value !== 'number') {
      throw new OperationError('Una comparación solo sirve dentro de SI(...).');
    }
    return value;
  }
}

function analyzeOperation(source: string, context?: FormulaContext): FormulaAnalysis {
  try {
    const evaluator = new Evaluator(context);
    const value = evaluator.evaluate(new Parser(tokenize(source)).parse());
    if (typeof value !== 'number') {
      return { kind: 'error', error: 'La operación debe dar un monto, no un sí o un no.' };
    }
    const result = finish(value);
    if (!result.ok) return result;
    if (result.value < 0) evaluator.warnings.push('El resultado es negativo.');
    return {
      kind: 'formula',
      value: result.value,
      steps: evaluator.steps,
      warnings: evaluator.warnings,
      references: evaluator.references,
    };
  } catch (error) {
    if (error instanceof OperationError) return { kind: 'error', error: error.message };
    throw error;
  }
}
