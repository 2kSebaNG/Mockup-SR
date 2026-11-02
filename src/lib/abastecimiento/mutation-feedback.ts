import { apiErrorText } from './api-error';

/** What a mutation can say about itself, through TanStack's `meta`. Both are optional:
 * a mutation without them still toasts its failure, with the generic text. */
export interface MutationFeedbackMeta {
  /** Toast shown when the mutation succeeds; without it success stays silent. */
  successMessage?: string | undefined;
  /** Text shown when the backend's own message has no Spanish translation. */
  errorMessage?: string | undefined;
  /** The screen shows this mutation's failure itself, so no toast. */
  silent?: boolean | undefined;
}

export const GENERIC_ERROR_TEXT = 'No se pudo completar la acción. Inténtalo de nuevo.';
export const OFFLINE_ERROR_TEXT = 'No se pudo conectar con el servidor. Revisa tu conexión.';

/** `fetch` rejects with a `TypeError` (and no HTTP body) when the request never got an
 * answer — offline, DNS, the API down. */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network|load failed/i.test((error as Error).message);
}

/** The Spanish text of a failed mutation's toast. */
export function mutationErrorText(error: unknown, meta?: MutationFeedbackMeta): string {
  if (isNetworkFailure(error)) return OFFLINE_ERROR_TEXT;
  return apiErrorText(error, meta?.errorMessage ?? GENERIC_ERROR_TEXT);
}

/** `meta` comes off TanStack typed as a loose record; keep only the fields we know. */
export function feedbackMeta(meta: unknown): MutationFeedbackMeta {
  if (!meta || typeof meta !== 'object') return {};
  const { successMessage, errorMessage, silent } = meta as Record<string, unknown>;
  return {
    successMessage: typeof successMessage === 'string' ? successMessage : undefined,
    errorMessage: typeof errorMessage === 'string' ? errorMessage : undefined,
    silent: silent === true ? true : undefined,
  };
}
