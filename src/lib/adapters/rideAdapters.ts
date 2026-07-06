/**
 * Ride adapters — Sprint 2.4.
 *
 * ÚNICO ponto de conversão entre modelos relacionados a corrida.
 * Nenhum outro arquivo pode transformar RideModel ↔ ShiftRide ↔ DailyEntry
 * ↔ RideEntry legacy.
 *
 * Camada de tradução PURA — zero dependência de storage/services/DOM.
 *
 * Extensível para futuras exportações (ExportRide/PdfRide/CloudRide).
 */

import type { RideModel, CaptureMode, RideEdit } from '../domain/models';
import type { DailyEntry, RideEntry } from '../types';

// ─── Tipo legacy usado exclusivamente pela UI de turno (display shape) ────
// Historicamente vivia em `shifts.ts`. Foi movido para cá para centralizar
// conversões. Nenhum código novo deve criar um ShiftRide diretamente:
// consumir via `rideModelToShiftRide(m)`.
export type ShiftRideResultado = 'boa' | 'aceitavel' | 'ruim';

export interface ShiftRideEdit {
  campo: 'km' | 'valor';
  valor_antigo: number;
  valor_novo: number;
  data_edicao: string;
}

export interface ShiftRide {
  corrida_id: string;
  turno_id: string;
  valor: number;
  km: number;
  km_original?: number;
  valor_original?: number;
  valor_por_km: number;
  resultado: ShiftRideResultado;
  data_registro: string;
  data_operacional: string;
  edicoes?: ShiftRideEdit[];
  observacao?: string;
  km_origem?: 'auto' | 'manual';
}

// ─── verdict ↔ resultado ─────────────────────────────────────────────────
export function verdictToResultado(v?: 'good' | 'ok' | 'bad'): ShiftRideResultado {
  if (v === 'good') return 'boa';
  if (v === 'bad') return 'ruim';
  return 'aceitavel';
}
export function resultadoToVerdict(r: ShiftRideResultado): 'good' | 'ok' | 'bad' {
  if (r === 'boa') return 'good';
  if (r === 'ruim') return 'bad';
  return 'ok';
}

// ─── Edit history ────────────────────────────────────────────────────────
export function shiftEditToRideEdit(e: ShiftRideEdit): RideEdit {
  return {
    field: e.campo === 'km' ? 'km' : 'value',
    from: e.valor_antigo,
    to: e.valor_novo,
    at: e.data_edicao,
  };
}
export function rideEditToShiftEdit(e: RideEdit): ShiftRideEdit {
  return {
    campo: e.field === 'km' ? 'km' : 'valor',
    valor_antigo: e.from,
    valor_novo: e.to,
    data_edicao: e.at,
  };
}

// ─── RideModel → ShiftRide (display) ─────────────────────────────────────
export function rideModelToShiftRide(m: RideModel): ShiftRide {
  const valor_por_km = m.km > 0 ? m.value / m.km : 0;
  return {
    corrida_id: m.id,
    turno_id: m.shiftId ?? '',
    valor: m.value,
    km: m.km,
    km_original: m.originalKm,
    valor_original: m.originalValue,
    valor_por_km,
    resultado: verdictToResultado(m.analysis?.verdict),
    data_registro: m.date,
    data_operacional: m.operationalDate ?? m.date.slice(0, 10),
    edicoes: m.edits?.map(rideEditToShiftEdit),
    observacao: m.notes,
    km_origem: m.kmOrigin,
  };
}

// ─── ShiftRide legacy → RideModel (usado APENAS na migração one-shot) ────
export interface ShiftContextForMigration {
  turno_id: string;
  veiculo_id?: string;
  data_operacional: string;
  rota?: Array<unknown>;
}

export function shiftRideToRideModel(
  sr: ShiftRide,
  ctx: ShiftContextForMigration,
): RideModel {
  const captureMode: CaptureMode = sr.km_origem === 'auto' ? 'gps' : 'manual';
  const hasRoute = !!(ctx.rota && ctx.rota.length > 0);
  return {
    id: sr.corrida_id,
    date: sr.data_registro,
    captureMode,
    value: Number(sr.valor) || 0,
    km: Number(sr.km) || 0,
    vehicleId: ctx.veiculo_id,
    notes: sr.observacao,
    shiftId: ctx.turno_id,
    operationalDate: sr.data_operacional ?? ctx.data_operacional,
    kmOrigin: sr.km_origem,
    originalKm: sr.km_original,
    originalValue: sr.valor_original,
    edits: sr.edicoes?.map(shiftEditToRideEdit),
    analysis: {
      costPerKm: 0,
      minIdealKm: 0,
      ridePerKm: sr.valor_por_km,
      profit: 0,
      verdict: resultadoToVerdict(sr.resultado),
    },
    gps: hasRoute ? { points: (ctx.rota as unknown[]).length } : undefined,
  };
}

// ─── RideEntry legacy → RideModel (migração one-shot) ────────────────────
export function rideEntryToRideModel(r: RideEntry): RideModel {
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

// ─── DailyEntry legacy (agregado) → RideModel (imported) ─────────────────
export function dailyEntryToRideModel(e: DailyEntry): RideModel {
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
