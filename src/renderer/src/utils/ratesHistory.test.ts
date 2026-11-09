import { describe, expect, it } from 'vitest';
import { appendRatePoint, type RatePoint } from './ratesHistory';

describe('appendRatePoint', () => {
  it('replaces same-day point and keeps bounded chronological history', () => {
    const old: RatePoint[] = [
      { date: '2026-11-07', rate: 1.1 },
      { date: '2026-11-08', rate: 1.2 },
    ];
    expect(appendRatePoint(old, { date: '2026-11-08', rate: 1.3 }, 2)).toEqual([
      { date: '2026-11-07', rate: 1.1 },
      { date: '2026-11-08', rate: 1.3 },
    ]);
  });

  it('ignores invalid rates', () => {
    expect(appendRatePoint([], { date: '2026-11-08', rate: 0 }, 10)).toEqual([]);
  });
});
