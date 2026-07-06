/**
 * telemetry — Sprint 3.
 *
 * Versão mínima. Ring buffer local de 100 eventos.
 * NÃO contém PII, geolocalização, valores financeiros nem histórico.
 *
 * Uso oficial nesta sprint: apenas migration_events (rideRepository
 * ensureMigratedFromLegacy). Base para futura remoção segura do código
 * legacy quando >99% dos devices tiverem migrado.
 */

const KEY = 'vd-telemetry';
const MAX = 100;

export interface MigrationEvent {
  kind: 'migration:legacy-rides';
  at: string;         // ISO
  duration: number;   // ms
  ridesMigrated: number;
}

export type TelemetryEvent = MigrationEvent;

function read(): TelemetryEvent[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function write(list: TelemetryEvent[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const capped = list.length > MAX ? list.slice(list.length - MAX) : list;
    localStorage.setItem(KEY, JSON.stringify(capped));
  } catch { /* storage cheio ou negado — telemetria não bloqueia app */ }
}

export const telemetry = {
  recordMigration(payload: Omit<MigrationEvent, 'kind' | 'at'>): void {
    const evt: MigrationEvent = {
      kind: 'migration:legacy-rides',
      at: new Date().toISOString(),
      duration: Math.max(0, Math.round(payload.duration)),
      ridesMigrated: Math.max(0, Math.round(payload.ridesMigrated)),
    };
    // Só registra a primeira ocorrência (migração é one-shot por device).
    const cur = read();
    if (cur.some(e => e.kind === 'migration:legacy-rides')) return;
    write([...cur, evt]);
  },
  list(): TelemetryEvent[] { return read(); },
};
