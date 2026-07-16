/**
 * telemetry — Sprint 3, estendido nas Sprints 4 e 6.
 *
 * Ring buffer local + contadores agregados. NÃO contém PII, coordenadas,
 * valores financeiros nem histórico.
 *
 * Contadores oficiais:
 *   - GPS (Sprint 4):
 *       gps_detection, gps_auto_saved, gps_false_positive, gps_false_negative
 *   - Gamificação (Sprint 6):
 *       achievement_unlocked, xp_earned, level_up
 */

const EVENTS_KEY = 'vd-telemetry';
const COUNTERS_KEY = 'vd-telemetry-counters';
const GAMIF_KEY = 'vd-telemetry-gamification';
const MAX = 100;

export interface MigrationEvent {
  kind: 'migration:legacy-rides';
  at: string;
  duration: number;
  ridesMigrated: number;
}

export type TelemetryEvent = MigrationEvent;

export type GpsCounter =
  | 'gps_detection'
  | 'gps_auto_saved'
  | 'gps_false_positive'
  | 'gps_false_negative';

export interface GpsCounters {
  gps_detection: number;
  gps_auto_saved: number;
  gps_false_positive: number;
  gps_false_negative: number;
}

export type GamificationCounter =
  | 'achievement_unlocked'
  | 'xp_earned'
  | 'level_up'
  // Sprint 6.2.5 — Cloud Sync
  | 'gamification_sync'
  | 'gamification_merge'
  | 'gamification_conflict';

export interface GamificationCounters {
  achievement_unlocked: number;
  xp_earned: number;      // soma de XP ganho (não contagem de chamadas)
  level_up: number;
  gamification_sync: number;
  gamification_merge: number;
  gamification_conflict: number;
}

function emptyCounters(): GpsCounters {
  return { gps_detection: 0, gps_auto_saved: 0, gps_false_positive: 0, gps_false_negative: 0 };
}

function emptyGamif(): GamificationCounters {
  return {
    achievement_unlocked: 0, xp_earned: 0, level_up: 0,
    gamification_sync: 0, gamification_merge: 0, gamification_conflict: 0,
  };
}

function readEvents(): TelemetryEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeEvents(list: TelemetryEvent[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const capped = list.length > MAX ? list.slice(list.length - MAX) : list;
    localStorage.setItem(EVENTS_KEY, JSON.stringify(capped));
  } catch { /* storage cheio — telemetria não bloqueia app */ }
}

function readCounters(): GpsCounters {
  if (typeof localStorage === 'undefined') return emptyCounters();
  try {
    const raw = localStorage.getItem(COUNTERS_KEY);
    if (!raw) return emptyCounters();
    const parsed = JSON.parse(raw);
    return { ...emptyCounters(), ...parsed };
  } catch { return emptyCounters(); }
}

function writeCounters(c: GpsCounters): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(COUNTERS_KEY, JSON.stringify(c)); } catch { /* noop */ }
}

function readGamif(): GamificationCounters {
  if (typeof localStorage === 'undefined') return emptyGamif();
  try {
    const raw = localStorage.getItem(GAMIF_KEY);
    if (!raw) return emptyGamif();
    const parsed = JSON.parse(raw);
    return { ...emptyGamif(), ...parsed };
  } catch { return emptyGamif(); }
}

function writeGamif(c: GamificationCounters): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(GAMIF_KEY, JSON.stringify(c)); } catch { /* noop */ }
}

export const telemetry = {
  recordMigration(payload: Omit<MigrationEvent, 'kind' | 'at'>): void {
    const evt: MigrationEvent = {
      kind: 'migration:legacy-rides',
      at: new Date().toISOString(),
      duration: Math.max(0, Math.round(payload.duration)),
      ridesMigrated: Math.max(0, Math.round(payload.ridesMigrated)),
    };
    const cur = readEvents();
    if (cur.some(e => e.kind === 'migration:legacy-rides')) return;
    writeEvents([...cur, evt]);
  },
  list(): TelemetryEvent[] { return readEvents(); },

  // ─── GPS (Sprint 4) ────────────────────────────────────────────────
  recordGps(counter: GpsCounter, delta = 1): void {
    const cur = readCounters();
    cur[counter] = Math.max(0, (cur[counter] ?? 0) + delta);
    writeCounters(cur);
  },
  gpsCounters(): GpsCounters { return readCounters(); },
  detectionAccuracy(): number | null {
    const c = readCounters();
    if (c.gps_detection <= 0) return null;
    return Math.max(0, Math.min(1, c.gps_auto_saved / c.gps_detection));
  },

  // ─── Gamificação (Sprint 6) ────────────────────────────────────────
  /**
   * Registra evento de gamificação SEM PII. `delta` representa:
   *   - achievement_unlocked: contagem (+1 por conquista)
   *   - xp_earned: quantidade de XP ganho na operação
   *   - level_up: nível recém-atingido (usado como marcador; agregamos o máx.)
   */
  recordGamification(counter: GamificationCounter, delta = 1): void {
    const cur = readGamif();
    if (counter === 'level_up') {
      cur.level_up = Math.max(cur.level_up, Math.max(0, Math.floor(delta)));
    } else {
      cur[counter] = Math.max(0, (cur[counter] ?? 0) + Math.max(0, Math.floor(delta)));
    }
    writeGamif(cur);
  },
  gamificationCounters(): GamificationCounters { return readGamif(); },
};
