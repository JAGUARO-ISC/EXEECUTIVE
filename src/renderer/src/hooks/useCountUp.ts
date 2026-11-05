import { useEffect, useRef, useState } from 'react';

export const interpolateCount = (start: number, target: number, progress: number): number =>
  start + (target - start) * Math.max(0, Math.min(1, progress));

export const shouldReduceMotion = (matchMedia: (query: string) => { matches: boolean } | boolean): boolean => {
  const result = matchMedia('(prefers-reduced-motion: reduce)');
  return typeof result === 'boolean' ? result : result.matches;
};

const formatInteger = (value: string, separator: string): string => {
  const groups: string[] = [];
  for (let end = value.length; end > 0; end -= 3) groups.unshift(value.slice(Math.max(0, end - 3), end));
  return groups.join(separator);
};

/** Replaces only the first numeric part, preserving currency text and separators. */
export const formatCountUpValue = (template: string, value: number): string => {
  const match = template.match(/[-+]?\d[\d.,]*(?:\s+)?/);
  if (!match || !Number.isFinite(value)) return template;
  const token = match[0];
  const numericToken = token.trim();
  const unsigned = numericToken.replace(/^[-+]/, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  const lastSeparator = Math.max(lastComma, lastDot);
  const digitsAfter = lastSeparator >= 0 ? unsigned.length - lastSeparator - 1 : 0;
  const hasDecimal = digitsAfter > 0 && digitsAfter <= 2;
  const decimalDigits = hasDecimal ? digitsAfter : 0;
  const decimalSeparator = hasDecimal ? unsigned[lastSeparator] : '';
  const groupingSeparator = hasDecimal
    ? (decimalSeparator === ',' ? '.' : ',')
    : (unsigned.includes('.') ? '.' : unsigned.includes(',') ? ',' : '');
  const fixed = Math.abs(value).toFixed(decimalDigits);
  const [integer, fraction] = fixed.split('.');
  const formatted = `${value < 0 ? '-' : ''}${formatInteger(integer, groupingSeparator)}${fraction === undefined ? '' : decimalSeparator + fraction}`;
  return `${template.slice(0, match.index)}${formatted}${token.slice(numericToken.length)}${template.slice((match.index ?? 0) + token.length)}`;
};

export const useCountUp = (target: number, duration = 800): number => {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined' && shouldReduceMotion(window.matchMedia);
    if (reduceMotion || duration <= 0) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const start = valueRef.current;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const next = interpolateCount(start, target, 1 - Math.pow(1 - progress, 3));
      valueRef.current = next;
      setValue(next);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
};

export const formatStatValue = (template: string, animated: number): string => formatCountUpValue(template, animated);
