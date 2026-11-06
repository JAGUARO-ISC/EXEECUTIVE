import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTutorialStore } from './tutorial';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});

beforeEach(() => {
  storage.clear();
  useTutorialStore.setState({ userId: null, status: 'idle', step: 0 });
});

describe('tutorial state', () => {
  it('starts only for a user and completes within bounds', () => {
    useTutorialStore.getState().start('user-1');
    expect(useTutorialStore.getState().status).toBe('running');
    useTutorialStore.getState().next();
    expect(useTutorialStore.getState().step).toBe(1);
    useTutorialStore.getState().complete();
    expect(useTutorialStore.getState().status).toBe('completed');
  });

  it('persists completion after the final step', () => {
    useTutorialStore.getState().start('user-1');
    for (let i = 0; i < 7; i += 1) useTutorialStore.getState().next();
    expect(useTutorialStore.getState().status).toBe('completed');
    expect(localStorage.getItem('exec_tutorial:user-1')).toBe('completed');
  });

  it('can skip and restart for the same account', () => {
    useTutorialStore.getState().start('user-1');
    useTutorialStore.getState().skip();
    expect(useTutorialStore.getState().status).toBe('skipped');
    useTutorialStore.getState().restart();
    expect(useTutorialStore.getState().status).toBe('running');
    expect(localStorage.getItem('exec_tutorial:user-1')).toBeNull();
  });
});
