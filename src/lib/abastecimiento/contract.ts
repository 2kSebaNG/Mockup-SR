import type { components } from './api/schema';
import { formatAmount } from './format';

export type ContractsReconciliation = components['schemas']['ContractsReconciliation'];

/** A contrato cannot end before it starts (the API checks it too); blank means indefinido. */
export function contratoDatesError(startDate: string, endDate: string): string | undefined {
  if (!startDate || !endDate) return undefined;
  return endDate < startDate
    ? 'El término del contrato no puede ser anterior a su inicio.'
    : undefined;
}

/**
 * What to tell about how the amounts of a deal's contratos compare with what the deal is worth
 * now. `warn` is for a difference worth looking at, `ok` for when they add up, `info` for when
 * there is nothing to compare yet.
 */
export function contractsNote(
  contracts: ContractsReconciliation,
  dealValue: number,
): { tone: 'ok' | 'warn' | 'info'; text: string } {
  const value = formatAmount(dealValue);
  const missing =
    contracts.withoutAmount === 0
      ? ''
      : contracts.withoutAmount === 1
        ? ' Hay 1 contrato sin monto.'
        : ` Hay ${contracts.withoutAmount} contratos sin monto.`;
  switch (contracts.state) {
    case 'NO_AMOUNTS':
      return {
        tone: 'info',
        text: `Ningún contrato tiene monto todavía. Ponles el monto adjudicado para compararlo con el valor del negocio (${value}).`,
      };
    case 'MATCHES':
      return {
        tone: 'ok',
        text: `Los contratos suman ${formatAmount(contracts.total)}: cuadran con el valor actual del negocio.${missing}`,
      };
    case 'BELOW':
      return {
        tone: 'warn',
        text: `Los contratos suman ${formatAmount(contracts.total)}, ${formatAmount(contracts.difference)} menos que el valor actual del negocio (${value}).${missing}`,
      };
    case 'ABOVE':
      return {
        tone: 'warn',
        text: `Los contratos suman ${formatAmount(contracts.total)}, ${formatAmount(-contracts.difference)} más que el valor actual del negocio (${value}).${missing}`,
      };
  }
}

/** The body of a contrato edit from the form's fields: a cleared date is an indefinido end or no
 * start, and a cleared amount is no amount — `null` is how the API is told. */
export function contratoPatch(fields: {
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  amount: string;
}): {
  name: string;
  code: string;
  startDate: string | null;
  endDate: string | null;
  amount: number | null;
} {
  return {
    name: fields.name.trim(),
    code: fields.code.trim(),
    startDate: fields.startDate || null,
    endDate: fields.endDate || null,
    amount: fields.amount.trim() === '' ? null : Number(fields.amount),
  };
}
