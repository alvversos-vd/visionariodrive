/**
 * AchievementService — Sprint 6 · Fase 2.
 *
 * ÚNICA API pública de conquistas. Owner: achievementRepository.
 * Emite 'achievement:unlocked' quando desbloqueia. Credita XP via xpService.
 *
 * O contexto (StatsContext) é construído aqui, lendo APENAS Services
 * (rideService, shiftService, financialService, profileRepository via
 * profileService quando disponível). Nada de storage direto.
 */
import { achievementRepository, type UnlockedAchievement } from '../repositories/achievementRepository';
import { gamificationRepository } from '../repositories/gamificationRepository';
import { ACHIEVEMENTS, type Achievement, type StatsContext, getAchievement } from '../gamification/catalog';
import { rideService } from './rideService';
import { shiftService } from './shiftService';
import { financialService } from './financialService';
import { goalsService } from './goalsService';
import { xpService } from './xpService';
import { eventBus } from '../eventBus';
import { telemetry } from '../telemetry';

const TABS_KEY = 'vd-tabs-visited-v1';

function readTabsVisited(): number {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr).size : 0;
  } catch { return 0; }
}

function markTabVisited(tab: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(TABS_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(arr) ? arr : []);
    set.add(tab);
    localStorage.setItem(TABS_KEY, JSON.stringify([...set]));
  } catch { /* noop */ }
}

function ymd(iso: string): string { return new Date(iso).toISOString().slice(0, 10); }

/** Calcula streak trailing (a partir de hoje ou do último dia com corrida). */
function computeConsecutiveDays(rideDates: string[]): number {
  if (rideDates.length === 0) return 0;
  const days = new Set(rideDates.map(ymd));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  // Se hoje não tem corrida mas ontem sim, o streak trailing "vivo" pode começar de ontem
  let cursor = new Date(today);
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeGoalHitCount(rides: { date: string; value: number; profit?: number }[], dailyGoal: number): number {
  if (dailyGoal <= 0) return 0;
  const totals = new Map<string, number>();
  for (const r of rides) {
    const key = ymd(r.date);
    const v = Number.isFinite(r.profit) ? Number(r.profit) : Number(r.value) || 0;
    totals.set(key, (totals.get(key) ?? 0) + v);
  }
  let hits = 0;
  for (const v of totals.values()) if (v >= dailyGoal) hits++;
  return hits;
}

export const achievementService = {
  list(): Achievement[] { return ACHIEVEMENTS.slice(); },
  get: getAchievement,
  unlocked(): UnlockedAchievement[] { return achievementRepository.read().unlocked; },

  /** Snapshot de estatísticas — usado pela engine e pela UI. */
  snapshotContext(accountCreatedAt: string | null = null): StatsContext {
    const rides = rideService.list();
    const income = financialService.list({ type: 'income' });
    const bonus = financialService.list({ type: 'bonus' });
    const shifts = shiftService.list();
    const dailyGoal = goalsService.getDaily();
    const totalRideEarned = rides.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const totalFinancial = income.concat(bonus).reduce((s, e) => s + (Number(e.value) || 0), 0);
    return {
      ridesTotal: rides.length,
      totalKm: rides.reduce((s, r) => s + (Number(r.km) || 0), 0),
      totalEarned: totalRideEarned + totalFinancial,
      shiftsTotal: shifts.length,
      consecutiveDays: computeConsecutiveDays(rides.map(r => r.date)),
      goalHitCount: computeGoalHitCount(rides, dailyGoal),
      accountCreatedAt,
      tabsVisited: readTabsVisited(),
    };
  },

  /**
   * Avalia o catálogo contra o contexto atual, desbloqueia novas conquistas
   * e credita XP correspondente. Retorna a lista de IDs desbloqueados nesta
   * chamada (para toasts). Idempotente: uma mesma conquista NUNCA é
   * desbloqueada duas vezes.
   */
  evaluate(accountCreatedAt: string | null = null): string[] {
    const ctx = this.snapshotContext(accountCreatedAt);
    const state = achievementRepository.read();
    const already = new Set(state.unlocked.map(u => u.id));
    const newlyUnlocked: string[] = [];
    const nowIso = new Date().toISOString();

    for (const a of ACHIEVEMENTS) {
      if (already.has(a.id)) continue;
      let ok = false;
      try { ok = a.condition(ctx); } catch { ok = false; }
      if (!ok) continue;
      state.unlocked.push({ id: a.id, unlockedAt: nowIso });
      already.add(a.id);
      newlyUnlocked.push(a.id);
    }

    // Atualiza snapshot de stats no payload de gamificação (para sync entre
    // dispositivos). Feito mesmo sem novas conquistas — stats evolui sozinho.
    try {
      const shifts = shiftService.list();
      const longestShiftMinutes = shifts.reduce((max, s) => {
        const start = s?.inicio_turno ? Date.parse(s.inicio_turno) : NaN;
        const end = s?.fim_turno ? Date.parse(s.fim_turno) : NaN;
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return max;
        return Math.max(max, Math.round((end - start) / 60000));
      }, 0);
      const g = gamificationRepository.read();
      g.stats = {
        rides: ctx.ridesTotal,
        distanceKm: Math.round(ctx.totalKm * 100) / 100,
        turns: ctx.shiftsTotal,
        earnings: Math.round(ctx.totalEarned * 100) / 100,
        longestShiftMinutes,
        currentStreak: ctx.consecutiveDays,
      };
      gamificationRepository.write(g);
    } catch { /* stats é acessório — nunca bloqueia evaluate */ }

    if (newlyUnlocked.length === 0) return [];

    // Persiste primeiro para garantir idempotência mesmo em falha posterior
    achievementRepository.write(state);

    for (const id of newlyUnlocked) {
      const def = getAchievement(id);
      if (!def) continue;
      telemetry.recordGamification('achievement_unlocked', 1);
      xpService.addXp(def.xp, `achievement:${id}`);
      eventBus.emit('achievement:unlocked');
    }
    return newlyUnlocked;
  },

  /** Registra visita a uma tab; útil para conquista Explorador. */
  markTabVisited(tab: string): void { markTabVisited(tab); },

  /** Uso interno de dataLifecycle/testes. */
  reset(): void {
    achievementRepository.reset();
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(TABS_KEY); } catch { /* noop */ }
    }
    eventBus.emit('achievement:unlocked');
  },
};

export type { StatsContext, Achievement };
