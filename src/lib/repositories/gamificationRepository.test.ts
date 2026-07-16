/**
 * Testes de merge determinístico e persistência do gamificationRepository.
 * Sprint 6.2.5 — Cloud Sync da Gamificação.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  gamificationRepository,
  mergeGamification,
  emptyGamification,
  GAMIFICATION_KEY,
  GAMIFICATION_SCHEMA_VERSION,
  type GamificationPayload,
} from './gamificationRepository';

beforeEach(() => { localStorage.clear(); });

function make(over: Partial<GamificationPayload> = {}): GamificationPayload {
  return { ...emptyGamification(), ...over };
}

describe('gamificationRepository', () => {
  it('read retorna payload vazio quando não existe (primeiro sync)', () => {
    expect(gamificationRepository.read()).toEqual(emptyGamification());
  });

  it('write persiste e retorna com updatedAt setado', () => {
    gamificationRepository.write(make({ xp: { totalXp: 250 } }));
    const g = gamificationRepository.read();
    expect(g.xp.totalXp).toBe(250);
    expect(g.updatedAt).not.toBeNull();
    expect(g.schemaVersion).toBe(GAMIFICATION_SCHEMA_VERSION);
  });

  it('schemaVersion é preservado; payload inválido cai no default', () => {
    localStorage.setItem(GAMIFICATION_KEY, 'not-json');
    expect(gamificationRepository.read().schemaVersion).toBe(GAMIFICATION_SCHEMA_VERSION);
  });

  it('compatibilidade retroativa: coerce aceita JSON parcial', () => {
    const raw = { xp: { totalXp: 999 }, achievements: [{ id: 'x', unlockedAt: '2026-01-01T00:00:00Z' }] };
    localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(raw));
    const g = gamificationRepository.read();
    expect(g.xp.totalXp).toBe(999);
    expect(g.achievements).toHaveLength(1);
  });

  it('reset zera o payload', () => {
    gamificationRepository.write(make({ xp: { totalXp: 500 } }));
    gamificationRepository.reset();
    expect(gamificationRepository.read().xp.totalXp).toBe(0);
  });
});

describe('mergeGamification — determinístico', () => {
  it('XP: mantém sempre o MAIOR totalXp (nunca reduz)', () => {
    const a = make({ xp: { totalXp: 300 } });
    const b = make({ xp: { totalXp: 100 } });
    expect(mergeGamification(a, b).merged.xp.totalXp).toBe(300);
    expect(mergeGamification(b, a).merged.xp.totalXp).toBe(300);
  });

  it('Achievements: união por id, preservando unlockedAt mais antigo', () => {
    const older = '2026-01-01T00:00:00.000Z';
    const newer = '2026-06-01T00:00:00.000Z';
    const a = make({ achievements: [{ id: 'first_ride', unlockedAt: newer }] });
    const b = make({ achievements: [
      { id: 'first_ride', unlockedAt: older },
      { id: 'first_shift', unlockedAt: newer },
    ]});
    const { merged } = mergeGamification(a, b);
    expect(merged.achievements.map(x => x.id).sort()).toEqual(['first_ride', 'first_shift']);
    expect(merged.achievements.find(x => x.id === 'first_ride')!.unlockedAt).toBe(older);
  });

  it('Achievements: nunca REMOVE conquista desbloqueada', () => {
    const a = make({ achievements: [{ id: 'k', unlockedAt: '2026-01-01T00:00:00.000Z' }] });
    const b = make(); // vazio
    expect(mergeGamification(a, b).merged.achievements).toHaveLength(1);
    expect(mergeGamification(b, a).merged.achievements).toHaveLength(1);
  });

  it('Stats: sempre o MÁXIMO por campo', () => {
    const a = make({ stats: { rides: 10, distanceKm: 100, currentStreak: 3, earnings: 500, longestShiftMinutes: 600, turns: 5 } });
    const b = make({ stats: { rides: 25, distanceKm: 50,  currentStreak: 7, earnings: 200, longestShiftMinutes: 720, turns: 4 } });
    const { merged } = mergeGamification(a, b);
    expect(merged.stats.rides).toBe(25);
    expect(merged.stats.distanceKm).toBe(100);
    expect(merged.stats.currentStreak).toBe(7);
    expect(merged.stats.earnings).toBe(500);
    expect(merged.stats.longestShiftMinutes).toBe(720);
    expect(merged.stats.turns).toBe(5);
  });

  it('updatedAt: escolhe o mais recente', () => {
    const a = make({ updatedAt: '2026-01-01T00:00:00.000Z' });
    const b = make({ updatedAt: '2026-07-15T00:00:00.000Z' });
    expect(mergeGamification(a, b).merged.updatedAt).toBe('2026-07-15T00:00:00.000Z');
  });

  it('hadConflict=true quando estados divergem em XP', () => {
    const a = make({ xp: { totalXp: 100 } });
    const b = make({ xp: { totalXp: 200 } });
    expect(mergeGamification(a, b).hadConflict).toBe(true);
  });

  it('hadConflict=false quando payloads já são idênticos', () => {
    const a = make({ xp: { totalXp: 100 }, achievements: [{ id: 'a', unlockedAt: '2026-01-01T00:00:00.000Z' }] });
    const b = make({ xp: { totalXp: 100 }, achievements: [{ id: 'a', unlockedAt: '2026-01-01T00:00:00.000Z' }] });
    expect(mergeGamification(a, b).hadConflict).toBe(false);
  });

  it('Cenário troca de aparelho: cloud (XP alto) sobrescreve local zerado', () => {
    const local = emptyGamification();
    const cloud = make({
      xp: { totalXp: 4150 },
      achievements: [{ id: 'first_ride', unlockedAt: '2026-05-01T00:00:00.000Z' }],
      stats: { rides: 120, distanceKm: 1425 },
      updatedAt: '2026-07-14T00:00:00.000Z',
    });
    const { merged } = mergeGamification(local, cloud);
    expect(merged.xp.totalXp).toBe(4150);
    expect(merged.achievements).toHaveLength(1);
    expect(merged.stats.rides).toBe(120);
  });

  it('Cenário reinstalação: local zerado + cloud completo → resultado completo', () => {
    const cloud = make({ xp: { totalXp: 999 }, achievements: [{ id: 'x', unlockedAt: '2026-02-01T00:00:00.000Z' }] });
    const merged = mergeGamification(emptyGamification(), cloud).merged;
    expect(merged.xp.totalXp).toBe(999);
  });

  it('Cenário offline→online: local avança, cloud desatualizado é preservado', () => {
    const cloudOld = make({ xp: { totalXp: 500 } });
    const localAdvanced = make({ xp: { totalXp: 700 } });
    expect(mergeGamification(localAdvanced, cloudOld).merged.xp.totalXp).toBe(700);
  });
});
