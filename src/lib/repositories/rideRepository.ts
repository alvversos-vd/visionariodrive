/**
 * RideRepository — DONO ÚNICO oficial de RideModel (Fase 2.4).
 *
 * Fonte física primária: `localStorage['vd-rides']` — payload versionado
 *   { schemaVersion, rides: RideModel[] }
 *
 * A partir da Fase 2.3, este é o ÚNICO owner de corridas persistidas.
 * A Fase 2.4 elimina a dupla-escrita restante: Shift.rides NÃO é mais
 * escrito por nenhuma orquestração — apenas lido na migração one-shot.
 *
 * DailyEntry (calculador diário agregado) permanece como um acessor legacy
 * — não é uma corrida individual e vive em outro modelo (`lucro-delivery-entries`).
 *
 * ─── Migração one-shot ──────────────────────────────────────────────────
 * Na primeira leitura sem `vd-rides`, um adapter converte tudo que existe
 * no legacy (RideEntry, Shift.rides antigos, DailyEntry) para RideModel e
 * grava em `vd-rides`. Nenhum dado legacy é apagado — rollback seguro.
 */

import {
  getEntries,
  getRides,
  saveEntry as legacySaveEntry,
  upsertEntry as legacyUpsertEntry,
  deleteEntry as legacyDeleteEntry,
} from '../storage';
import { getShifts } from '../shifts';
import { getTombstones, tombstoneRide } from '../tombstones';
import { writeJson } from './baseRepository';
import { eventBus } from '../eventBus';
import { telemetry } from '../telemetry';
import type { DailyEntry } from '../types';
import {
  RIDE_SCHEMA_VERSION,
  type RidePayload,
  type RideModel,
} from '../domain/models';
import {
  rideEntryToRideModel,
  shiftRideToRideModel,
  dailyEntryToRideModel,
  type ShiftRide,
} from '../adapters/rideAdapters';

const RIDES_KEY = 'vd-rides';

// ─── Persistência versionada ─────────────────────────────────────────────
function migrateRidesPayload(raw: unknown): RideModel[] {
  if (raw && typeof raw === 'object' && Array.isArray((raw as RidePayload).rides)) {
    return (raw as RidePayload).rides;
  }
  if (Array.isArray(raw)) return raw as RideModel[];
  return [];
}

function loadPayload(): RidePayload {
  // Não usar readVersioned() aqui: o payload físico é `{schemaVersion, rides}`
  // (contrato oficial do RidePayload), enquanto readVersioned assume
  // `{schemaVersion, data}`. Rodamos o migrator sempre para normalizar
  // ambos os formatos e defender contra payloads legacy/corrompidos vindos
  // do cloudSync (coluna `rides_v2`).
  if (typeof localStorage === 'undefined') {
    return { schemaVersion: RIDE_SCHEMA_VERSION, rides: [] };
  }
  const raw = localStorage.getItem(RIDES_KEY);
  if (!raw) return { schemaVersion: RIDE_SCHEMA_VERSION, rides: [] };
  try {
    const parsed = JSON.parse(raw);
    const dead = new Set(getTombstones().rides);
    const rides = migrateRidesPayload(parsed).filter(r => r.id && !dead.has(r.id));
    return { schemaVersion: RIDE_SCHEMA_VERSION, rides };
  } catch {
    return { schemaVersion: RIDE_SCHEMA_VERSION, rides: [] };
  }
}

/**
 * Sprint 10.4.9 — toda escrita de corrida é CRÍTICA:
 *  - carimba `updatedAt` (desempate determinístico no merge cloud);
 *  - persiste local ANTES de qualquer rede (durabilidade não depende de push);
 *  - enfileira no outbox durável em modo imediato.
 */
function persist(payload: RidePayload, opts: { silent?: boolean; immediate?: boolean } = {}): void {
  writeJson(RIDES_KEY, payload, { immediate: opts.immediate !== false });
  if (!opts.silent) eventBus.emit('rides:changed');
}

function touch(ride: RideModel): RideModel {
  return { ...ride, updatedAt: new Date().toISOString() };
}

// ─── Migração one-shot dos dados legacy ──────────────────────────────────
let migrationRan = false;
function ensureMigratedFromLegacy(): void {
  if (migrationRan) return;
  migrationRan = true;
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(RIDES_KEY)) return; // já existe payload canônico

  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const seeded: RideModel[] = [];
  const seen = new Set<string>();
  const push = (m: RideModel) => {
    if (!m.id || seen.has(m.id)) return;
    seen.add(m.id);
    seeded.push(m);
  };

  try { for (const r of getRides())   push(rideEntryToRideModel(r)); } catch { /* noop */ }
  try {
    for (const s of getShifts()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legacyRides: ShiftRide[] = (s as any).rides ?? [];
      for (const sr of legacyRides) {
        push(shiftRideToRideModel(sr, {
          turno_id: s.turno_id,
          veiculo_id: s.veiculo_id,
          data_operacional: s.data_operacional,
          rota: s.rota,
        }));
      }
    }
  } catch { /* noop */ }
  try { for (const e of getEntries()) push(dailyEntryToRideModel(e)); } catch { /* noop */ }

  // Migração one-shot — silent para não emitir rides:changed em bootstrap
  // (nenhum hook está subscrito ainda; evita render extra).
  persist({ schemaVersion: RIDE_SCHEMA_VERSION, rides: seeded }, { silent: true });

  try {
    const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    telemetry.recordMigration({
      duration: endedAt - startedAt,
      ridesMigrated: seeded.length,
    });
  } catch { /* telemetria nunca bloqueia app */ }
}

// ─── API canônica (RideModel) ─────────────────────────────────────────────
export const rideRepository = {
  // ---- CRUD RideModel (fonte única de verdade) --------------------------
  list(): RideModel[] {
    ensureMigratedFromLegacy();
    return loadPayload().rides
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  listByShift(shiftId: string): RideModel[] {
    if (!shiftId) return [];
    ensureMigratedFromLegacy();
    return loadPayload().rides
      .filter(r => r.shiftId === shiftId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  /** Agrupa todas as corridas por shiftId — util para relatórios/exports. */
  groupByShift(): Map<string, RideModel[]> {
    ensureMigratedFromLegacy();
    const map = new Map<string, RideModel[]>();
    for (const r of loadPayload().rides) {
      if (!r.shiftId) continue;
      const arr = map.get(r.shiftId) ?? [];
      arr.push(r);
      map.set(r.shiftId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return map;
  },

  getById(id: string): RideModel | null {
    ensureMigratedFromLegacy();
    return loadPayload().rides.find(r => r.id === id) ?? null;
  },

  add(ride: RideModel): RideModel {
    ensureMigratedFromLegacy();
    const payload = loadPayload();
    const idx = payload.rides.findIndex(r => r.id === ride.id);
    if (idx >= 0) payload.rides[idx] = ride;
    else payload.rides.push(ride);
    persist(payload);
    return ride;
  },

  update(id: string, patch: Partial<RideModel>): RideModel | null {
    ensureMigratedFromLegacy();
    const payload = loadPayload();
    const idx = payload.rides.findIndex(r => r.id === id);
    if (idx < 0) return null;
    payload.rides[idx] = { ...payload.rides[idx], ...patch, id };
    persist(payload);
    return payload.rides[idx];
  },

  remove(id: string): void {
    ensureMigratedFromLegacy();
    const payload = loadPayload();
    const next = payload.rides.filter(r => r.id !== id);
    if (next.length !== payload.rides.length) {
      persist({ ...payload, rides: next });
    }
  },

  // ---- DailyEntry legacy delegates (Calculador Diário — não é ride individual)
  /** @deprecated DailyEntry legacy — usar `rideRepository.list()` quando possível. */
  listEntries(): DailyEntry[] { return getEntries(); },
  /** @deprecated Escrita legacy — Calculador Diário ainda depende. */
  saveEntry(entry: DailyEntry): void { legacySaveEntry(entry); },
  /** @deprecated Escrita legacy — Calculador Diário ainda depende. */
  upsertEntry(entry: DailyEntry): void { legacyUpsertEntry(entry); },
  /** @deprecated Escrita legacy. */
  deleteEntry(id: string): void { legacyDeleteEntry(id); },
};

// ─── Read unificado ──────────────────────────────────────────────────────
/**
 * Retorna TODOS os RideModel visíveis ao usuário.
 *
 * Fase 2.4: `vd-rides` é a ÚNICA fonte de verdade para corridas individuais.
 * DailyEntry agregado (calculador diário) continua entrando como
 * `captureMode='imported'` para preservar a timeline histórica.
 */
export function readAllRideModels(): RideModel[] {
  ensureMigratedFromLegacy();
  const canonical = loadPayload().rides;
  const byId = new Map<string, RideModel>();
  for (const r of canonical) byId.set(r.id, r);

  // DailyEntry agregado — imported. Só entra se ainda não migrado.
  try {
    for (const e of getEntries()) {
      const m = dailyEntryToRideModel(e);
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
  } catch { /* noop */ }

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
