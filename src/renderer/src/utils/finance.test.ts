import { describe, expect, it } from 'vitest';
import { pctChange } from './finance';

describe('pctChange', () => {
  it('treats a zero-to-positive balance as a full increase', () => {
    expect(pctChange(200000, 0)).toBe(100);
  });

  it('returns mathematical change for non-zero baseline', () => {
    expect(pctChange(7500, 10000)).toBe(-25);
  });

  it('returns zero when both values are zero', () => {
    expect(pctChange(0, 0)).toBe(0);
  });

  it('treats a zero-to-negative balance as a full decrease', () => {
    expect(pctChange(-200000, 0)).toBe(-100);
  });
});
