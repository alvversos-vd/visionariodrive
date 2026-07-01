/**
 * RideRepository — owner físico de DailyEntry, RideEntry e leitura de Shift.rides.
 *
 * Nesta sprint (1.5) delega para `storage.ts` e `shifts.ts` porque a raiz de
 * tracking (Shift/GPS) ainda usa esses módulos diretamente. Na Fase 2, quando
 * o Shift migrar, os bytes passam a viver aqui.
 *
 * Escrita de RideModel unificado NÃO existe nesta sprint (adapter só-leitura).
 */

import {
  getEntries,
  getRides,
  saveEntry as legacySaveEntry,
  upsertEntry as legacyUpsertEntry,
  deleteEntry as legacyDeleteEntry,
  saveRide as legacySaveRide,
  deleteRide as legacyDeleteRide,
} from '../storage';
import { getShifts } from '../shifts';
import type { DailyEntry, RideEntry } from '../types';
import type { Shift, ShiftRide } from '../shifts';
import type { RideModel, CaptureMode } from '../domain/models';

// ─── Leitura crua ─────────────────────────────────────────────────────────
export const rideRepository = {
  // DailyEntry (agregado diário — origem manual/shift)
  listEntries(): DailyEntry[] { return getEntries(); },
  saveEntry(entry: DailyEntry): void { legacySaveEntry(entry); },
  upsertEntry(entry: DailyEntry): void { legacyUpsertEntry(entry); },
  deleteEntry(id: string): void { legacyDeleteEntry(id); },

  // RideEntry (corridas individuais registradas via FAB)
  listRides(): RideEntry[] { return getRides(); },
  saveRide(ride: RideEntry): void { legacySaveRide(ride); },
  deleteRide(id: string): void { legacyDeleteRide(id); },

  // Shift.rides (corridas capturadas dentro de turno — GPS/manual)
  listShifts(): Shift[] { return getShifts(); },
};

// ─── Adapter para RideModel (read-side) ───────────────────────────────────
function rideEntryToModel(r: RideEntry): RideModel {
  return {
    id: r.id,
    date: r.date,
    captureMode: 'manual',
    value: r.value,
    km: r.km,
    vehicleId: undefined,
    notes: r.rideType,
  };
}

function shiftRideToModel(sr: ShiftRide, shift: Shift): RideModel {
  const captureMode: CaptureMode = sr.origem === 'automatica' ? 'gps' : 'manual';
  return {
    id: sr.id,
    date: sr.inicio_corrida ?? new Date().toISOString(),
    captureMode,
    value: Number(sr.ganho) || 0,
    km: Number(sr.distancia_km) || 0,
    durationMin: sr.duracao_min,
    vehicleId: shift.veiculo_id,
    gps: sr.polyline_pontos && sr.polyline_pontos.length > 0
      ? { points: sr.polyline_pontos.length }
      : undefined,
  };
}

function dailyEntryToModel(e: DailyEntry): RideModel {
  // Um DailyEntry é um agregado do dia — expõe como RideModel resumo,
  // captureMode `imported` para diferenciar de corridas individuais.
  return {
    id: e.id,
    date: e.date,
    captureMode: 'imported',
    value: e.totalEarnings,
    km: e.kmDriven,
    durationMin: e.hoursWorked > 0 ? Math.round(e.hoursWorked * 60) : undefined,
    vehicleId: undefined,
    notes: e.vehicle,
  };
}

export function readAllRideModels(): RideModel[] {
  const out: RideModel[] = [];
  for (const r of rideRepository.listRides()) out.push(rideEntryToModel(r));
  for (const s of rideRepository.listShifts()) {
    for (const sr of s.corridas ?? []) out.push(shiftRideToModel(sr, s));
  }
  for (const e of rideRepository.listEntries()) out.push(dailyEntryToModel(e));
  out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return out;
}
