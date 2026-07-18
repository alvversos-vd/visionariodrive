/**
 * XpService — Sprint 6 · Fase 2 + Sprint 6.3.
 *
 * ÚNICA API pública de XP. Consome xpRepository. Emite:
 *   - 'xp:changed' em toda mutação
 *   - 'xp:earned'  quando ganha XP > 0
 *   - 'level-up'   quando o nível sobe (bus sem payload; hooks releem)
 *
 * Sprint 6.3:
 *   - earnedToday(): XP ganho no dia atual (persistido em localStorage).
 *   - weeklySeries(): últimas N semanas de XP para gráfico "Minha Evolução".
 */
import { xpRepository, type XpState } from '../repositories/xpRepository';
import { eventBus } from '../eventBus';
import { levelForXp, progressForXp, type LevelProgress } from '../gamification/levels';
import { telemetry } from '../telemetry';

export interface XpAward {
  amount: number;
  reason: string;
  atMs: number;
  levelUp: boolean;
  newLevel: number;
  prevLevel: number;
}

const DAILY_KEY = 'vd-xp-daily-v1';
const WEEKLY_KEY = 'vd-xp-weekly-v1';
const WEEKLY_MAX = 12;

let lastAward: XpAward | null = null;

function todayYmd(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(d: Date = new Date()): string {
  // ISO week (approximation good enough for local UI history)
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

interface DailyBucket { date: string; xp: number }
interface WeeklyBucket { week: string; xp: number; endXp: number }

function readDaily(): DailyBucket {
  if (typeof localStorage === 'undefined') return { date: todayYmd(), xp: 0 };
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return { date: todayYmd(), xp: 0 };
    const p = JSON.parse(raw);
    if (p && typeof p.date === 'string' && typeof p.xp === 'number') return p as DailyBucket;
  } catch { /* noop */ }
  return { date: todayYmd(), xp: 0 };
}
function writeDaily(b: DailyBucket): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(b)); } catch { /* noop */ }
}
function readWeekly(): WeeklyBucket[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WEEKLY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeWeekly(list: WeeklyBucket[]): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(WEEKLY_KEY, JSON.stringify(list.slice(-WEEKLY_MAX))); } catch { /* noop */ }
}

function recordDaily(delta: number): void {
  const cur = readDaily();
  const today = todayYmd();
  const next = cur.date === today ? { ...cur, xp: cur.xp + delta } : { date: today, xp: delta };
  writeDaily(next);
}

function recordWeekly(newTotalXp: number): void {
  const week = isoWeekKey();
  const list = readWeekly();
  const idx = list.findIndex(b => b.week === week);
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = { week, xp: newTotalXp - (list.length > 1 ? list[idx - 1]?.endXp ?? prev.endXp - prev.xp : 0), endXp: newTotalXp };
  } else {
    const lastEnd = list.length > 0 ? list[list.length - 1].endXp : 0;
    list.push({ week, xp: Math.max(0, newTotalXp - lastEnd), endXp: newTotalXp });
  }
  writeWeekly(list);
}

export const xpService = {
  get(): XpState { return xpRepository.read(); },

  progress(): LevelProgress {
    return progressForXp(xpRepository.read().totalXp);
  },

  getLastAward(): XpAward | null { return lastAward; },

  /** XP ganho hoje (0 se dia virou). */
  earnedToday(): number {
    const b = readDaily();
    return b.date === todayYmd() ? b.xp : 0;
  },

  /** Últimas N semanas de XP (mais antigas primeiro). */
  weeklySeries(limit = 8): Array<{ week: string; xp: number; endXp: number }> {
    const list = readWeekly();
    return list.slice(-limit);
  },

  addXp(amount: number, reason: string): XpAward | null {
    const delta = Math.max(0, Math.floor(amount));
    if (delta <= 0) return null;
    const before = xpRepository.read();
    const prevLevel = levelForXp(before.totalXp);
    const nextTotal = before.totalXp + delta;
    const nextLevel = levelForXp(nextTotal);
    const levelUp = nextLevel > prevLevel;

    xpRepository.write({ totalXp: nextTotal, updatedAt: new Date().toISOString() });
    recordDaily(delta);
    recordWeekly(nextTotal);
    lastAward = { amount: delta, reason, atMs: Date.now(), levelUp, newLevel: nextLevel, prevLevel };

    telemetry.recordGamification('xp_earned', delta);
    eventBus.emit('xp:earned');
    eventBus.emit('xp:changed');
    if (levelUp) {
      telemetry.recordGamification('level_up', nextLevel);
      eventBus.emit('level-up');
    }
    return lastAward;
  },

  reset(): void {
    xpRepository.reset();
    lastAward = null;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(DAILY_KEY); } catch { /* noop */ }
      try { localStorage.removeItem(WEEKLY_KEY); } catch { /* noop */ }
    }
    eventBus.emit('xp:changed');
  },
};

export type XpProgress = LevelProgress;
