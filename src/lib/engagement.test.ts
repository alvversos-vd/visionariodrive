import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTutorialStatus, saveTutorialStatus } from './engagement';

describe('account-scoped tutorial preferences', () => {
  beforeEach(() => localStorage.clear());
  it('never shares completion with another account', () => {
    saveTutorialStatus('account-a', 'completed');
    expect(getTutorialStatus('account-a')).toBe('completed');
    expect(getTutorialStatus('account-b')).toBeNull();
    saveTutorialStatus('account-b', 'skipped');
    expect(getTutorialStatus('account-a')).toBe('completed');
    expect(getTutorialStatus('account-b')).toBe('skipped');
  });
  it('persists distinct deferred, active, skipped and completed states', () => {
    for (const status of ['deferred', 'in_progress', 'skipped', 'completed'] as const) {
      expect(saveTutorialStatus('a', status)).toBe(true);
      expect(getTutorialStatus('a')).toBe(status);
    }
  });
  it('preserves other engagement data and handles corrupt data', () => {
    localStorage.setItem('lucro-delivery-engagement', '{"other":42}');
    saveTutorialStatus('a', 'deferred');
    expect(JSON.parse(localStorage.getItem('lucro-delivery-engagement') || '{}').other).toBe(42);
    localStorage.setItem('lucro-delivery-engagement', 'broken');
    expect(getTutorialStatus('a')).toBeNull();
    expect(saveTutorialStatus('', 'completed')).toBe(false);
  });
  it('fails safely when storage is unavailable', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(saveTutorialStatus('a', 'completed')).toBe(false);
    write.mockRestore();
  });
});