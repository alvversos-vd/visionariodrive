/**
 * Testes da curva de níveis e da engine/serviços de XP+Conquistas.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { xpForLevel, levelForXp, progressForXp } from '@/lib/gamification/levels';
import { xpService } from '@/lib/services/xpService';
import { achievementService } from '@/lib/services/achievementService';
import { xpEngine } from '@/lib/gamification/xpEngine';
import { eventBus } from '@/lib/eventBus';

beforeEach(() => {
  localStorage.clear();
  xpService.reset();
  achievementService.reset();
});

describe('levels', () => {
  it('xpForLevel segue a curva 50*n*(n+1)', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(300);
    expect(xpForLevel(5)).toBe(1500);
    expect(xpForLevel(10)).toBe(5500);
  });

  it('levelForXp é inverso de xpForLevel', () => {
    for (let n = 0; n <= 12; n++) {
      expect(levelForXp(xpForLevel(n))).toBe(n);
      expect(levelForXp(xpForLevel(n + 1) - 1)).toBe(n);
    }
  });

  it('progressForXp calcula pct e remaining', () => {
    const p = progressForXp(150); // level 1 (100..300)
    expect(p.level).toBe(1);
    expect(p.currentLevelXp).toBe(50);
    expect(p.nextLevelXp).toBe(200);
    expect(p.remainingXp).toBe(150);
    expect(p.pct).toBeCloseTo(0.25, 3);
  });
});

describe('xpService', () => {
  it('addXp acumula, sobe de nível e emite eventos', () => {
    const before = eventBus.getVersion('xp:changed');
    const beforeLevel = eventBus.getVersion('level-up');
    xpService.addXp(120, 'test');
    expect(xpService.get().totalXp).toBe(120);
    expect(xpService.progress().level).toBe(1);
    expect(eventBus.getVersion('xp:changed')).toBeGreaterThan(before);
    expect(eventBus.getVersion('level-up')).toBeGreaterThan(beforeLevel);
  });

  it('addXp com valor <=0 é no-op', () => {
    expect(xpService.addXp(0, 'x')).toBeNull();
    expect(xpService.addXp(-5, 'x')).toBeNull();
    expect(xpService.get().totalXp).toBe(0);
  });

  it('não emite level-up quando permanece no mesmo nível', () => {
    xpService.addXp(50, 'a'); // nível 0
    const v = eventBus.getVersion('level-up');
    xpService.addXp(40, 'b'); // ainda 0
    expect(eventBus.getVersion('level-up')).toBe(v);
  });
});

describe('achievementService', () => {
  it('catálogo tem IDs únicos e XP positivo', () => {
    const list = achievementService.list();
    expect(list.length).toBeGreaterThanOrEqual(15);
    const ids = new Set(list.map(a => a.id));
    expect(ids.size).toBe(list.length);
    for (const a of list) expect(a.xp).toBeGreaterThan(0);
  });

  it('evaluate desbloqueia founder/early_beta com createdAt antigo', () => {
    const unlocked = achievementService.evaluate('2026-07-01T00:00:00Z');
    expect(unlocked).toContain('founder');
    expect(unlocked).toContain('early_beta');
    // XP creditado
    expect(xpService.get().totalXp).toBeGreaterThan(0);
  });

  it('não desbloqueia a mesma conquista duas vezes (idempotência)', () => {
    achievementService.evaluate('2026-07-01T00:00:00Z');
    const xpAfterFirst = xpService.get().totalXp;
    const second = achievementService.evaluate('2026-07-01T00:00:00Z');
    expect(second).toEqual([]);
    expect(xpService.get().totalXp).toBe(xpAfterFirst);
  });

  it('reset limpa conquistas', () => {
    achievementService.evaluate('2026-07-01T00:00:00Z');
    expect(achievementService.unlocked().length).toBeGreaterThan(0);
    achievementService.reset();
    expect(achievementService.unlocked().length).toBe(0);
  });
});

describe('xpEngine', () => {
  it('start assina o bus e agenda avaliação inicial', async () => {
    xpEngine.stop();
    xpEngine.start();
    xpEngine.setAccountContext('2026-07-01T00:00:00Z');
    await new Promise(r => queueMicrotask(() => r(null)));
    expect(achievementService.unlocked().length).toBeGreaterThan(0);
  });

  it('reage a rides:changed sem quebrar mesmo sem contexto', async () => {
    xpEngine.stop();
    xpEngine.start();
    eventBus.emit('rides:changed');
    await new Promise(r => queueMicrotask(() => r(null)));
    // não lança
    expect(true).toBe(true);
  });
});
