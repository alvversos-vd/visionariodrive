/**
 * RideRepository — DONO ÚNICO oficial de RideModel (Fase 2.3).
 *
 * Fonte física primária: `localStorage['vd-rides']` — payload versionado
 *   { schemaVersion, rides: RideModel[] }
 *
 * A partir da Fase 2.3, este é o ÚNICO owner de corridas. `Shift.rides`
 * deixa de ser fonte de verdade — o módulo Shift chama `rideService.addGpsRide`
 * ao registrar uma corrida, e RideRepository persiste em `vd-rides`.
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
import { readVersioned, writeJson } from './baseRepository';
import type { DailyEntry, RideEntry } from '../types';
import type { Shift, ShiftRide } from '../shifts';
import {
  RIDE_SCHEMA_VERSION,
  type RidePayload,
  type RideModel,
  type CaptureMode,
} from '../domain/models';

const RIDES_KEY = 'vd-rides';

// ─── Adapter legacy → RideModel (usado APENAS na migração one-shot) ──────
function rideEntryToModel(r: RideEntry): RideModel {
  return {
    id: r.id,
    date: r.date,
    captureMode: 'manual',
    value: r.value,
    km: r.km,
    vehicleName: r.vehicle,
    rideType: r.rideType,
    notes: r.rideType,
    analysis: {
      costPerKm: r.costPerKm,
      minIdealKm: r.minIdealKm,
      ridePerKm: r.ridePerKm,
      profit: r.profit,
      verdict: r.verdict,
    },
  };
}

function shiftRideToModel(sr: ShiftRide, shift: Shift): RideModel {
  const captureMode: CaptureMode = sr.km_origem === 'auto' ? 'gps' : 'manual';
  const hasRoute = !!(shift.rota && shift.rota.length > 0);
  return {
    id: sr.corrida_id,
    date: sr.data_registro,
    captureMode,
    value: Number(sr.valor) || 0,
    km: Number(sr.km) || 0,
    vehicleId: shift.veiculo_id,
    notes: sr.observacao,
    shiftId: shift.turno_id,
    gps: hasRoute ? { points: shift.rota!.length } : undefined,
  };
}

function dailyEntryToModel(e: DailyEntry): RideModel {
  return {
    id: e.id,
    date: e.date,
    captureMode: 'imported',
    value: e.totalEarnings,
    km: e.kmDriven,
    durationMin: e.hoursWorked > 0 ? Math.round(e.hoursWorked * 60) : undefined,
    vehicleName: e.vehicle,
    rideType: e.rideType,
    notes: e.vehicle,
  };
}

// ─── Persistência versionada ─────────────────────────────────────────────
function migrateRidesPayload(raw: unknown): RideModel[] {
  if (raw && typeof raw === 'object' && Array.isArray((raw as RidePayload).rides)) {
    return (raw as RidePayload).rides;
  }
  if (Array.isArray(raw)) return raw as RideModel[];
  return [];
}

function loadPayload(): RidePayload {
  const v = readVersioned<RideModel[]>(
    RIDES_KEY,
    RIDE_SCHEMA_VERSION,
    migrateRidesPayload,
    () => [],
  );
  return { schemaVersion: v.schemaVersion, rides: v.data };
}

function persist(payload: RidePayload): void {
  writeJson(RIDES_KEY, payload);
}

// ─── Migração one-shot dos dados legacy ──────────────────────────────────
let migrationRan = false;
function ensureMigratedFromLegacy(): void {
  if (migrationRan) return;
  migrationRan = true;
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(RIDES_KEY)) return; // já existe payload canônico

  const seeded: RideModel[] = [];
  const seen = new Set<string>();
  const push = (m: RideModel) => {
    if (!m.id || seen.has(m.id)) return;
    seen.add(m.id);
    seeded.push(m);
  };

  try { for (const r of getRides())   push(rideEntryToModel(r)); } catch { /* noop */ }
  try {
    for (const s of getShifts()) {
      for (const sr of s.rides ?? []) push(shiftRideToModel(sr, s));
    }
  } catch { /* noop */ }
  try { for (const e of getEntries()) push(dailyEntryToModel(e)); } catch { /* noop */ }

  persist({ schemaVersion: RIDE_SCHEMA_VERSION, rides: seeded });
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
 * Fase 2.3: `vd-rides` é a ÚNICA fonte de verdade para corridas individuais.
 * `Shift.rides` NÃO participa mais desta leitura — toda corrida registrada
 * dentro de um turno passa por `rideService.addGpsRide()`, que já persiste
 * em `vd-rides` com `shiftId` correto.
 *
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
      const m = dailyEntryToModel(e);
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
  } catch { /* noop */ }

  return Array.from(byId.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
