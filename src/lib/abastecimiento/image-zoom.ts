/** Zoom and pan of a photo in the viewer, kept apart from the component so the math
 * can be tested. `x`/`y` are the offset of the photo's centre from the viewer's centre,
 * in screen pixels; `scale` is 1 when the whole photo fits. */
export interface ImageView {
  scale: number;
  x: number;
  y: number;
}

export const FIT_VIEW: ImageView = { scale: 1, x: 0, y: 0 };
export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
/** One button press or wheel notch. */
export const ZOOM_STEP = 1.25;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Multiplies the zoom by `factor` keeping the point under the cursor where it is
 * (`px`/`py` are the cursor's offset from the viewer's centre; 0/0 zooms about the
 * centre, as the buttons do). Back at "fits the screen" the photo is centred again.
 */
export function zoomAt(view: ImageView, factor: number, px = 0, py = 0): ImageView {
  const scale = clampScale(view.scale * factor);
  if (scale === MIN_SCALE) return FIT_VIEW;
  const ratio = scale / view.scale;
  return { scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/** Moves a zoomed-in photo; when it fits the screen there is nothing to move. */
export function panBy(view: ImageView, dx: number, dy: number): ImageView {
  if (view.scale <= MIN_SCALE) return view;
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/** "150%" — zoom as a percentage of the fitted size. */
export function zoomLabel(view: ImageView): string {
  return `${Math.round(view.scale * 100)}%`;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp)$/i;

/** Whether a file should open as a photo (zoomable) rather than in the PDF viewer. */
export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.test(fileName.trim());
}
