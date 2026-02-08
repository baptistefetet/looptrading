import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCREENER_FILTERS,
  buildScreenerSearchParams,
  type ScreenerQueryInput,
} from './useScreener';

describe('buildScreenerSearchParams', () => {
  it('includes pagination and sort params', () => {
    const input: ScreenerQueryInput = {
      filters: DEFAULT_SCREENER_FILTERS,
      sortBy: 'score',
      sortOrder: 'desc',
      pageIndex: 2,
      pageSize: 50,
    };

    const params = buildScreenerSearchParams(input);

    expect(params.get('sortBy')).toBe('score');
    expect(params.get('sortOrder')).toBe('desc');
    expect(params.get('limit')).toBe('50');
    expect(params.get('offset')).toBe('100');
  });

  it('omits empty filters and keeps selected ones', () => {
    const input: ScreenerQueryInput = {
      filters: {
        ...DEFAULT_SCREENER_FILTERS,
        minScore: '70',
        maxRsi: '55',
        aboveSma50: 'true',
        market: 'US',
      },
      sortBy: 'symbol',
      sortOrder: 'asc',
      pageIndex: 0,
      pageSize: 25,
    };

    const params = buildScreenerSearchParams(input);

    expect(params.get('minScore')).toBe('70');
    expect(params.get('maxRsi')).toBe('55');
    expect(params.get('aboveSma50')).toBe('true');
    expect(params.get('market')).toBe('US');
    expect(params.get('maxScore')).toBeNull();
    expect(params.get('minVolume')).toBeNull();
  });
});
