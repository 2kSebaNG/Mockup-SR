import {
  DEFAULT_PAGE_SIZE,
  pageButtons,
  parsePageSize,
  parsePositiveInt,
  patchListQuery,
  rangeLabel,
  totalPages,
} from '@/lib/abastecimiento/pagination';

describe('parsePositiveInt', () => {
  it('reads a positive whole number', () => {
    expect(parsePositiveInt('3', 1)).toBe(3);
  });

  it('falls back for anything else', () => {
    expect(parsePositiveInt(null, 1)).toBe(1);
    expect(parsePositiveInt('', 1)).toBe(1);
    expect(parsePositiveInt('0', 1)).toBe(1);
    expect(parsePositiveInt('-2', 1)).toBe(1);
    expect(parsePositiveInt('2.5', 1)).toBe(1);
    expect(parsePositiveInt('abc', 1)).toBe(1);
  });
});

describe('parsePageSize', () => {
  it('accepts the offered sizes', () => {
    expect(parsePageSize('25')).toBe(25);
    expect(parsePageSize('50')).toBe(50);
    expect(parsePageSize('100')).toBe(100);
  });

  it('falls back to the default for a size the list does not offer', () => {
    expect(parsePageSize('7')).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize('1000')).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('totalPages', () => {
  it('rounds up', () => {
    expect(totalPages(26, 25)).toBe(2);
    expect(totalPages(50, 25)).toBe(2);
    expect(totalPages(51, 25)).toBe(3);
  });

  it('is at least one page, even for an empty list', () => {
    expect(totalPages(0, 25)).toBe(1);
  });
});

describe('rangeLabel', () => {
  it('names the rows on the page out of the total', () => {
    expect(rangeLabel(1, 25, 312)).toBe('1–25 de 312');
    expect(rangeLabel(3, 25, 312)).toBe('51–75 de 312');
  });

  it('stops at the last row on the last page', () => {
    expect(rangeLabel(13, 25, 312)).toBe('301–312 de 312');
  });

  it('says so when there is nothing', () => {
    expect(rangeLabel(1, 25, 0)).toBe('0 resultados');
  });
});

describe('pageButtons', () => {
  it('shows every page of a short list', () => {
    expect(pageButtons(1, 1)).toEqual([1]);
    expect(pageButtons(2, 4)).toEqual([1, 2, 3, 4]);
    expect(pageButtons(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('collapses the middle of a long list around the current page', () => {
    expect(pageButtons(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('keeps the first pages together near the start and the last near the end', () => {
    expect(pageButtons(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageButtons(2, 20)).toEqual([1, 2, 3, 'gap', 20]);
    expect(pageButtons(20, 20)).toEqual([1, 'gap', 19, 20]);
  });

  it('draws a single skipped page as itself rather than a gap hiding one number', () => {
    expect(pageButtons(4, 8)).toEqual([1, 2, 3, 4, 5, 'gap', 8]);
    expect(pageButtons(5, 8)).toEqual([1, 'gap', 4, 5, 6, 7, 8]);
  });
});

describe('patchListQuery', () => {
  it('sets, replaces and drops values, leaving the rest alone', () => {
    expect(patchListQuery('q=acme&status=OPEN', { status: 'CLOSED' })).toBe('q=acme&status=CLOSED');
    expect(patchListQuery('q=acme&status=OPEN', { status: undefined })).toBe('q=acme');
    expect(patchListQuery('q=acme', { q: '' })).toBe('');
  });

  it('drops values equal to their default', () => {
    expect(patchListQuery('', { status: 'ALL' }, { status: 'ALL' })).toBe('');
  });

  it('returns to page 1 when anything but the page changes', () => {
    expect(patchListQuery('page=3&q=a', { q: 'ab' })).toBe('q=ab');
    expect(patchListQuery('page=3&q=a', { size: '50' })).toBe('q=a&size=50');
  });

  it('keeps the page when only the page changes', () => {
    expect(patchListQuery('q=a', { page: '3' })).toBe('q=a&page=3');
  });

  it('leaves out the default page size', () => {
    expect(patchListQuery('size=50', { size: String(DEFAULT_PAGE_SIZE) })).toBe('');
  });

  it('builds a second change on top of the first when the URL has not caught up yet', () => {
    const afterSwitch = patchListQuery('', { inactive: '1' });
    expect(patchListQuery(afterSwitch, { q: 'acme' })).toBe('inactive=1&q=acme');
  });
});
