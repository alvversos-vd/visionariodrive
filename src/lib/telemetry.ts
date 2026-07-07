/**
 * telemetry — Sprint 3, estendido na Sprint 4.
 *
 * Ring buffer local + contadores agregados. NÃO contém PII, coordenadas,
 * valores financeiros nem histórico.
 *
 * Usos oficiais:
 *   - migration:legacy-rides   (Sprint 3)
 *   - contadores GPS           (Sprint 4)
 *       gps_detection      → toda vez que o detector fecha uma corrida
 *                            (candidata ou descartada por confiança).
 *       gps_auto_saved     → corrida detectada foi persistida.
 *       gps_false_positive → usuário descartou/desfez uma corrida detectada.
 *       gps_false_negative → usuário registrou manualmente uma corrida
 *                            enquanto o detector estava em movimento.
 *
 * Precisão do detector = gps_auto_saved / gps_detection.
 */

const EVENTS_KEY = 'vd-telemetry';
const COUNTERS_KEY = 'vd-telemetry-counters';
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

function emptyCounters(): GpsCounters {
  return { gps_detection: 0, gps_auto_saved: 0, gps_false_positive: 0, gps_false_negative: 0 };
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
  /** Precisão da detecção — null quando ainda não há amostras. */
  detectionAccuracy(): number | null {
    const c = readCounters();
    if (c.gps_detection <= 0) return null;
    return Math.max(0, Math.min(1, c.gps_auto_saved / c.gps_detection));
  },
};
