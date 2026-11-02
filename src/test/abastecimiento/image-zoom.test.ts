import {
  clampScale,
  FIT_VIEW,
  isImageFile,
  MAX_SCALE,
  panBy,
  zoomAt,
  zoomLabel,
} from '@/lib/abastecimiento/image-zoom';

describe('zoomAt', () => {
  it('zooms about the centre when no point is given', () => {
    const view = zoomAt(FIT_VIEW, 2);
    expect(view).toEqual({ scale: 2, x: 0, y: 0 });
  });

  it('keeps the point under the cursor where it was', () => {
    // Cursor 100px right of the centre; after doubling, the photo has shifted 100px left
    // so the spot that was under the cursor still is.
    const view = zoomAt(FIT_VIEW, 2, 100, 40);
    expect(view.scale).toBe(2);
    expect(view.x).toBe(-100);
    expect(view.y).toBe(-40);
    // ...and zooming again about the same point keeps it fixed too.
    const again = zoomAt(view, 2, 100, 40);
    expect(again.x).toBe(-300);
    expect(again.y).toBe(-120);
  });

  it('never zooms past the limits', () => {
    expect(zoomAt(FIT_VIEW, 1000).scale).toBe(MAX_SCALE);
    expect(clampScale(0.2)).toBe(1);
  });

  it('centres the photo again once it is back to fitting the screen', () => {
    const zoomed = zoomAt(FIT_VIEW, 4, 50, 50);
    expect(zoomAt(zoomed, 0.1, 50, 50)).toEqual(FIT_VIEW);
  });
});

describe('panBy', () => {
  it('moves a zoomed-in photo', () => {
    expect(panBy({ scale: 2, x: 10, y: 0 }, 5, -3)).toEqual({ scale: 2, x: 15, y: -3 });
  });

  it('does nothing while the photo fits the screen', () => {
    expect(panBy(FIT_VIEW, 50, 50)).toBe(FIT_VIEW);
  });
});

describe('zoomLabel / isImageFile', () => {
  it('shows the zoom as a percentage', () => {
    expect(zoomLabel({ scale: 1.5625, x: 0, y: 0 })).toBe('156%');
    expect(zoomLabel(FIT_VIEW)).toBe('100%');
  });

  it('tells photos from PDFs by the file name', () => {
    expect(isImageFile('boleta.JPG')).toBe(true);
    expect(isImageFile('foto.jpeg')).toBe(true);
    expect(isImageFile('voucher.png')).toBe(true);
    expect(isImageFile('Rendición 029.pdf')).toBe(false);
    expect(isImageFile('sin-extension')).toBe(false);
  });
});
