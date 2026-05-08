import { markDirty } from './cloudSync';
import { getEntries, getSettings } from './storage';

const SHIFTS_KEY = 'lucro-delivery-shifts';

export type ShiftStatus = 'ativo' | 'finalizado';
export type RideResult = 'boa' | 'aceitavel' | 'ruim';

export interface ShiftRide {
  corrida_id: string;
  turno_id: string;
  valor: number;
  km: number;
  valor_por_km: number;
  resultado: RideResult;
  data_registro: string; // ISO
  data_operacional: string; // YYYY-MM-DD
}

export interface Shift {
  turno_id: string;
  status: ShiftStatus;
  inicio_turno: string; // ISO
  fim_turno?: string; // ISO
  data_operacional: string; // YYYY-MM-DD
  rides: ShiftRide[];
}

export function getShifts(): Shift[] {
  const raw = localStorage.getItem(SHIFTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveShifts(list: Shift[]) {
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(list));
  markDirty();
}

export function getActiveShift(): Shift | null {
  return getShifts().find(s => s.status === 'ativo') ?? null;
}

export function startShift(data_operacional: string): Shift {
  const list = getShifts();
  // garantir que não há outro ativo
  list.forEach(s => { if (s.status === 'ativo') { s.status = 'finalizado'; s.fim_turno = new Date().toISOString(); } });
  const shift: Shift = {
    turno_id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'ativo',
    inicio_turno: new Date().toISOString(),
    data_operacional,
    rides: [],
  };
  list.unshift(shift);
  saveShifts(list);
  return shift;
}

export function endShift(turno_id: string): Shift | null {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return null;
  s.status = 'finalizado';
  s.fim_turno = new Date().toISOString();
  saveShifts(list);
  return s;
}

export function getCostPerKm(): number {
  // média dos últimos 7 lançamentos com km > 0; senão settings/3 fallback
  const entries = getEntries().filter(e => e.kmDriven > 0).slice(0, 7);
  if (entries.length === 0) return 0;
  const totalCost = entries.reduce((s, e) => s + e.totalCost, 0);
  const totalKm = entries.reduce((s, e) => s + e.kmDriven, 0);
  return totalKm > 0 ? totalCost / totalKm : 0;
}

export function getMinIdealKm(): number {
  const cpk = getCostPerKm();
  const margin = getSettings().profitMargin || 1.3;
  return cpk * margin;
}

export function classifyRide(valor: number, km: number): { valor_por_km: number; resultado: RideResult } {
  const valor_por_km = km > 0 ? valor / km : 0;
  const cpk = getCostPerKm();
  const min = getMinIdealKm();
  let resultado: RideResult;
  if (cpk <= 0) {
    // sem base de custo — usa só valor/km com piso simples
    resultado = valor_por_km >= 2 ? 'boa' : valor_por_km >= 1.2 ? 'aceitavel' : 'ruim';
  } else if (valor_por_km >= min) resultado = 'boa';
  else if (valor_por_km >= cpk) resultado = 'aceitavel';
  else resultado = 'ruim';
  return { valor_por_km, resultado };
}

export function addRide(turno_id: string, valor: number, km: number): ShiftRide | null {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s || s.status !== 'ativo') return null;
  const { valor_por_km, resultado } = classifyRide(valor, km);
  const ride: ShiftRide = {
    corrida_id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    turno_id,
    valor,
    km,
    valor_por_km,
    resultado,
    data_registro: new Date().toISOString(),
    data_operacional: s.data_operacional,
  };
  s.rides.unshift(ride);
  saveShifts(list);
  return ride;
}

export function deleteRide(turno_id: string, corrida_id: string) {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return;
  s.rides = s.rides.filter(r => r.corrida_id !== corrida_id);
  saveShifts(list);
}

export interface ShiftTotals {
  ganho_total: number;
  km_total: number;
  corridas_total: number;
  custo_total: number;
  lucro_total: number;
  tempo_online_minutos: number;
  media_por_km: number;
}

export function computeTotals(shift: Shift): ShiftTotals {
  const ganho_total = shift.rides.reduce((s, r) => s + r.valor, 0);
  const km_total = shift.rides.reduce((s, r) => s + r.km, 0);
  const corridas_total = shift.rides.length;
  const cpk = getCostPerKm();
  const custo_total = cpk * km_total;
  const lucro_total = ganho_total - custo_total;
  const fim = shift.fim_turno ? new Date(shift.fim_turno).getTime() : Date.now();
  const tempo_online_minutos = Math.max(0, Math.round((fim - new Date(shift.inicio_turno).getTime()) / 60000));
  const media_por_km = km_total > 0 ? ganho_total / km_total : 0;
  return { ganho_total, km_total, corridas_total, custo_total, lucro_total, tempo_online_minutos, media_por_km };
}

export function formatTempo(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export function todayOperationalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function yesterdayOperationalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatOperationalDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
