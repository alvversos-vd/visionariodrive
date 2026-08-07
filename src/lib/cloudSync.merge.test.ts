import { describe, it, expect } from 'vitest';
import { mergeRidesPayload } from './cloudSync';

const ride = (id: string, updatedAt: string, value = 10) => ({
  id, value, km: 1, date: updatedAt, updatedAt,
});

describe('mergeRidesPayload (Sprint 10.4.9)', () => {
  it('preserva corrida local ausente no cloud (registro offline)', () => {
    const out = mergeRidesPayload(
      { schemaVersion: 1, rides: [ride('a', '2026-01-01T10:00:00Z')] },
      { schemaVersion: 1, rides: [] },
    );
    expect(out.rides.map(r => r.id)).toEqual(['a']);
  });

  it('faz união por id sem duplicar', () => {
    const out = mergeRidesPayload(
      { schemaVersion: 1, rides: [ride('a', '2026-01-01T10:00:00Z')] },
      { schemaVersion: 1, rides: [ride('a', '2026-01-01T10:00:00Z'), ride('b', '2026-01-01T11:00:00Z')] },
    );
    expect(out.rides.map(r => r.id).sort()).toEqual(['a', 'b']);
  });

  it('resolve conflito pelo maior updatedAt', () => {
    const out = mergeRidesPayload(
      { schemaVersion: 1, rides: [{ ...ride('a', '2026-01-01T10:00:00Z'), value: 10 }] },
      { schemaVersion: 1, rides: [{ ...ride('a', '2026-01-01T12:00:00Z'), value: 99 }] },
    );
    expect(out.rides[0]).toMatchObject({ id: 'a', value: 99 });
  });

  it('empate mantém o lado local', () => {
    const out = mergeRidesPayload(
      { schemaVersion: 1, rides: [{ ...ride('a', '2026-01-01T10:00:00Z'), value: 10 }] },
      { schemaVersion: 1, rides: [{ ...ride('a', '2026-01-01T10:00:00Z'), value: 99 }] },
    );
    expect(out.rides[0]).toMatchObject({ value: 10 });
  });

  it('tombstone impede ressurreição via cloud', () => {
    const out = mergeRidesPayload(
      { schemaVersion: 1, rides: [] },
      { schemaVersion: 1, rides: [ride('a', '2026-01-01T10:00:00Z')] },
      ['a'],
    );
    expect(out.rides).toEqual([]);
  });

  it('aceita payload legacy em array puro', () => {
    const out = mergeRidesPayload([ride('a', '2026-01-01T10:00:00Z')], null);
    expect(out).toEqual({ schemaVersion: 1, rides: [expect.objectContaining({ id: 'a' })] });
  });
});
