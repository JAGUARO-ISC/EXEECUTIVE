import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('does not stringify object errors', () => {
    expect(errorMessage({ code: 'failed' })).toBe('Operation failed.');
  });

  it('uses structured messages', () => {
    expect(errorMessage({ message: 'Network unavailable' })).toBe('Network unavailable');
  });
});
