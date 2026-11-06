import { beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarInitials, useProfileStore } from './profile';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

beforeEach(() => storage.clear());

describe('profile store', () => {
  it('builds initials from first and last name', () => {
    expect(avatarInitials('Mario', 'Rossi')).toBe('MR');
    expect(avatarInitials('mario', '')).toBe('M');
  });

  it('updates editable profile fields', () => {
    useProfileStore.setState({ firstName: 'Mario', lastName: 'Rossi', color: '#f97316', imageData: null });
    useProfileStore.getState().update({ firstName: 'Anna', lastName: 'Bianchi', color: '#2563eb' });
    expect(useProfileStore.getState().firstName).toBe('Anna');
    expect(useProfileStore.getState().initials()).toBe('AB');
    expect(JSON.parse(localStorage.getItem('exec_profile') ?? '{}')).toMatchObject({ firstName: 'Anna', lastName: 'Bianchi', color: '#2563eb' });
  });
});
