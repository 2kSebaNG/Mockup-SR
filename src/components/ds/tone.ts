import type { RequestStatus } from "@/lib/my-requests";

/**
 * The six meanings a colored element can carry. Each maps to one soft fill and the text that reads on it
 * (the --status-* tokens), so a badge, a callout and a stat in the same tone always match.
 */
export type Tone = "info" | "warning" | "progress" | "success" | "danger" | "neutral";

export const toneClass = (tone: Tone) => `ds-tone-${tone}`;

/** How the request statuses read as tones; new status sets should map onto the same six. */
export const requestStatusTone = {
  Enviada: "info",
  "En revisión": "warning",
  "En gestión": "progress",
  Completada: "success",
  Rechazado: "danger",
  Anulado: "neutral",
} as const satisfies Record<RequestStatus, Tone>;
