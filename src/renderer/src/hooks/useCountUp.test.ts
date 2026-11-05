import { describe, expect, it } from 'vitest';
import { formatCountUpValue, interpolateCount, shouldReduceMotion } from './useCountUp';

describe('count-up helpers', () => {
  it('interpolates zero and positive targets', () => {
    expect(interpolateCount(0, 120, 0)).toBe(0);
    expect(interpolateCount(0, 120, 0.5)).toBe(60);
    expect(interpolateCount(0, 120, 1)).toBe(120);
  });

  it('interpolates negative and decimal targets without rounding', () => {
    expect(interpolateCount(10, -10, 0.25)).toBe(5);
    expect(interpolateCount(0, 12.5, 0.4)).toBe(5);
  });

  it('formats the animated numeric part using the value string separators', () => {
    expect(formatCountUpValue('€ 3.200,00', 1250)).toBe('€ 1.250,00');
    expect(formatCountUpValue('-1,50 €', -0.75)).toBe('-0,75 €');
  });

  it('supports target changes and reduced-motion behavior', () => {
    expect(interpolateCount(40, 100, 0.5)).toBe(70);
    expect(shouldReduceMotion(() => true)).toBe(true);
    expect(shouldReduceMotion(() => false)).toBe(false);
  });
});
