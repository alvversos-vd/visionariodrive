import { markDirty } from './cloudSync';
import { getEntries, getSettings, upsertEntry } from './storage';
import { getVehicleById, vehicleCostPerKm, AppEntrega, Vehicle } from './vehicles';
import { DailyEntry } from './types';
import { tombstoneShift, tombstoneEntry } from './tombstones';
import type { RideModel } from './domain/models';
import { rideRepository } from './repositories/rideRepository';
// Re-export ShiftRide (tipo de display) para retrocompat de imports antigos.
export type { ShiftRide, ShiftRideEdit as RideEdit } from './adapters/rideAdapters';
import type { ShiftRide } from './adapters/rideAdapters';

const SHIFTS_KEY = 'lucro-delivery-shifts';

export type ShiftStatus = 'ativo' | 'pausado' | 'finalizado';
export type RideResult = 'boa' | 'aceitavel' | 'ruim';

export interface ShiftPause {
  inicio: string;
  fim?: string;
}

export interface Shift {
  turno_id: string;
  status: ShiftStatus;
  inicio_turno: string;
  fim_turno?: string;
  data_operacional: string;
  data_operacional_fim?: string;
  veiculo_id?: string;
  tipo_veiculo?: string;
  app_utilizado?: string;
  /**
   * @deprecated
   *
   * Campo LEGADO.
   *
   * NÃO utilizar em nenhum código novo.
   *
   * Mantido apenas para:
   *   • migração one-shot (rideRepository.ensureMigratedFromLegacy)
   *   • rollback / auditoria
   *   • compatibilidade com payloads antigos do cloud
   *
   * Fonte oficial de corridas:
   *   RideRepository (`vd-rides`) → RideService.listByShift(shiftId)
   */
  rides?: ShiftRide[];
  km_gps?: number;
  km_desde_ultima_corrida?: number;
  ultima_corrida_iso?: string;
  pausas?: ShiftPause[];
  timezone?: string;
  tz_offset_minutos?: number;
  tz_offset_fim_minutos?: number;
  /** Status do GPS no turno — preservado no histórico para auditoria. */
  gps_status?: 'ok' | 'denied' | 'unavailable' | 'pending';
  /** Pontos brutos da rota capturados pelo GPS. Limitado a ~5000 pontos. */
  rota?: Array<{ lat: number; lng: number; t: number; spd?: number; hdg?: number }>;
}

// Buffer de pontos da rota para batch-flush (evita gravar localStorage a cada fix).
type RoutePt = { lat: number; lng: number; t: number; spd?: number; hdg?: number };
const _routeBuffer: Record<string, RoutePt[]> = {};
let _routeFlushTimer: ReturnType<typeof setTimeout> | null = null;
const ROUTE_FLUSH_MS = 1500;

function flushRouteBuffer(): void {
  _routeFlushTimer = null;
  const ids = Object.keys(_routeBuffer);
  if (ids.length === 0) return;
  const list = getShifts();
  let touched = false;
  for (const id of ids) {
    const pts = _routeBuffer[id];
    delete _routeBuffer[id];
    if (!pts || pts.length === 0) continue;
    const s = list.find(x => x.turno_id === id);
    if (!s || s.status !== 'ativo') continue;
    s.rota = s.rota || [];
    if (s.rota.length + pts.length >= 5000) {
      s.rota = s.rota.filter((_, i) => i % 2 === 0);
    }
    s.rota.push(...pts);
    touched = true;
  }
  if (touched) saveShifts(list);
}

export function appendRoutePoint(turno_id: string, pt: RoutePt): void {
  (_routeBuffer[turno_id] = _routeBuffer[turno_id] || []).push(pt);
  if (!_routeFlushTimer) _routeFlushTimer = setTimeout(flushRouteBuffer, ROUTE_FLUSH_MS);
}

export function flushShiftBuffers(): void {
  if (_routeFlushTimer) { clearTimeout(_routeFlushTimer); flushRouteBuffer(); }
  if (_gpsFlushTimer) { clearTimeout(_gpsFlushTimer); flushGpsBuffer(); }
}

export function clearShiftRoute(turno_id: string): boolean {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return false;
  s.rota = [];
  saveShifts(list);
  return true;
}

export function clearAllRoutes(): number {
  const list = getShifts();
  let cleared = 0;
  list.forEach(s => {
    if (s.rota && s.rota.length > 0) { s.rota = []; cleared++; }
  });
  if (cleared > 0) saveShifts(list);
  return cleared;
}

export function setShiftGpsStatus(turno_id: string, status: NonNullable<Shift['gps_status']>): void {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return;
  if (s.gps_status === 'ok' && status !== 'ok') return;
  if (s.gps_status === status) return;
  s.gps_status = status;
  saveShifts(list);
}

function getDeviceTz(): { tz: string; offset: number } {
  let tz = 'UTC';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch {}
  const offset = -new Date().getTimezoneOffset();
  return { tz, offset };
}

function operationalDateFromDate(d: Date): string {
  const ref = new Date(d);
  if (ref.getHours() < 5) ref.setDate(ref.getDate() - 1);
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
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
  return getShifts().find(s => s.status === 'ativo' || s.status === 'pausado') ?? null;
}

export function pauseShift(turno_id: string): Shift | null {
  flushShiftBuffers();
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s || s.status !== 'ativo') return null;
  s.status = 'pausado';
  s.pausas = s.pausas || [];
  s.pausas.push({ inicio: new Date().toISOString() });
  saveShifts(list);
  return s;
}

export function resumeShift(turno_id: string): Shift | null {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s || s.status !== 'pausado') return null;
  s.status = 'ativo';
  const last = s.pausas?.[s.pausas.length - 1];
  if (last && !last.fim) last.fim = new Date().toISOString();
  saveShifts(list);
  return s;
}

// Buffer de distância para batch-flush (anti-flicker / debounce GPS).
const _gpsBuffer: Record<string, number> = {};
let _gpsFlushTimer: ReturnType<typeof setTimeout> | null = null;
const GPS_FLUSH_MS = 500;

function flushGpsBuffer(): void {
  _gpsFlushTimer = null;
  const ids = Object.keys(_gpsBuffer);
  if (ids.length === 0) return;
  const list = getShifts();
  let touched = false;
  for (const id of ids) {
    const meters = _gpsBuffer[id];
    delete _gpsBuffer[id];
    if (!meters || meters <= 0) continue;
    const s = list.find(x => x.turno_id === id);
    if (!s || s.status !== 'ativo') continue;
    const km = meters / 1000;
    s.km_gps = (s.km_gps || 0) + km;
    s.km_desde_ultima_corrida = (s.km_desde_ultima_corrida || 0) + km;
    touched = true;
  }
  if (touched) saveShifts(list);
}

export function addGpsDistance(turno_id: string, meters: number): void {
  if (!meters || meters <= 0) return;
  _gpsBuffer[turno_id] = (_gpsBuffer[turno_id] || 0) + meters;
  if (!_gpsFlushTimer) _gpsFlushTimer = setTimeout(flushGpsBuffer, GPS_FLUSH_MS);
}

/**
 * Marca uma corrida como registrada no turno — atualiza APENAS estado
 * de sessão (km_desde_ultima_corrida, ultima_corrida_iso). NÃO grava
 * corrida em Shift.rides — a fonte canônica é `vd-rides` via RideRepository.
 *
 * Chamado exclusivamente por `rideService.registerShiftRide`.
 */
export function markRideRegistered(turno_id: string, iso: string): void {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return;
  s.km_desde_ultima_corrida = 0;
  s.ultima_corrida_iso = iso;
  saveShifts(list);
}

export interface StartShiftOptions {
  data_operacional: string;
  veiculo_id: string;
  app_utilizado: AppEntrega | string;
}

export function startShift(opts: StartShiftOptions): Shift {
  const list = getShifts();
  list.forEach(s => {
    if (s.status === 'ativo' || s.status === 'pausado') {
      s.status = 'finalizado';
      s.fim_turno = new Date().toISOString();
      const { tz, offset } = getDeviceTz();
      s.timezone = s.timezone || tz;
      s.tz_offset_fim_minutos = offset;
      s.data_operacional_fim = s.data_operacional_fim || operationalDateFromDate(new Date());
    }
  });
  const v = getVehicleById(opts.veiculo_id);
  const now = new Date();
  const { tz, offset } = getDeviceTz();
  const shift: Shift = {
    turno_id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: 'ativo',
    inicio_turno: now.toISOString(),
    data_operacional: opts.data_operacional,
    veiculo_id: opts.veiculo_id,
    tipo_veiculo: v?.tipo_veiculo,
    app_utilizado: opts.app_utilizado,
    km_gps: 0,
    km_desde_ultima_corrida: 0,
    pausas: [],
    timezone: tz,
    tz_offset_minutos: offset,
    gps_status: 'pending',
  };
  list.unshift(shift);
  saveShifts(list);
  return shift;
}

export function endShift(turno_id: string): Shift | null {
  flushShiftBuffers();
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return null;
  if (s.status === 'pausado') {
    const last = s.pausas?.[s.pausas.length - 1];
    if (last && !last.fim) last.fim = new Date().toISOString();
  }
  const now = new Date();
  s.status = 'finalizado';
  s.fim_turno = now.toISOString();
  const { tz, offset } = getDeviceTz();
  s.timezone = s.timezone || tz;
  s.tz_offset_fim_minutos = offset;
  s.data_operacional_fim = operationalDateFromDate(now);
  saveShifts(list);

  // Deriva DailyEntry a partir das corridas canônicas do turno.
  try {
    const rides = rideRepository.listByShift(s.turno_id);
    const totals = computeTotals(s, rides);
    upsertEntryFromShift(s, totals);
  } catch { /* não bloqueia finalização */ }

  markDirty({ immediate: true });
  return s;
}

export async function endShiftAtomic(turno_id: string): Promise<Shift | null> {
  const finished = endShift(turno_id);
  if (!finished) return null;
  try {
    const { flushNow } = await import('./cloudSync');
    await flushNow();
  } catch { /* listeners cuidam no próximo ciclo */ }
  return finished;
}

export function deleteShift(turno_id: string): boolean {
  const list = getShifts();
  const target = list.find(s => s.turno_id === turno_id);
  if (!target) return false;
  const remaining = list.filter(s => s.turno_id !== turno_id);
  saveShifts(remaining);
  tombstoneShift(turno_id);

  try {
    const entries = getEntries();
    const derivedId = `shift_${turno_id}`;
    const next = entries.filter(e => e.id !== derivedId && e.shiftId !== turno_id);
    if (next.length !== entries.length) {
      localStorage.setItem('lucro-delivery-entries', JSON.stringify(next));
      tombstoneEntry(derivedId);
    }
  } catch { /* não-bloqueante */ }

  if (target.veiculo_id) {
    const newFirst = remaining
      .filter(s =>
        s.veiculo_id === target.veiculo_id &&
        s.data_operacional === target.data_operacional &&
        s.status === 'finalizado'
      )
      .sort((a, b) => a.inicio_turno.localeCompare(b.inicio_turno))[0];
    if (newFirst) {
      try {
        const rides = rideRepository.listByShift(newFirst.turno_id);
        const totals = computeTotals(newFirst, rides);
        upsertEntryFromShift(newFirst, totals);
      } catch { /* não-bloqueante */ }
    }
  }

  markDirty({ immediate: true });
  return true;
}

/**
 * Deriva DailyEntry a partir do turno finalizado e faz upsert idempotente
 * por shiftId. Recebe `totals` pré-computado (função pura) — não consulta
 * nenhum Service internamente.
 */
export function upsertEntryFromShift(shift: Shift, t: ShiftTotals): DailyEntry {
  const v = shift.veiculo_id ? getVehicleById(shift.veiculo_id) : null;

  const fuelPrice = v?.valor_combustivel_litro || 0;
  const vehicleConsumption = v?.km_por_litro || 0;
  const monthlyFixedCosts = v?.custo_fixo_mensal || 0;
  const litersConsumed = vehicleConsumption > 0 ? t.km_total / vehicleConsumption : 0;

  const [y, m, d] = shift.data_operacional.split('-').map(Number);
  const dateIso = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0).toISOString();

  const entry: DailyEntry = {
    id: `shift_${shift.turno_id}`,
    date: dateIso,
    hoursWorked: t.tempo_online_minutos / 60,
    kmDriven: t.km_total,
    totalEarnings: t.ganho_total,
    fuelPrice,
    vehicleConsumption,
    installment: 0,
    maintenance: 0,
    insurance: 0,
    otherCosts: 0,
    vehicle: v?.nome_veiculo,
    rideType: shift.app_utilizado,
    litersConsumed,
    fuelCost: t.custo_combustivel,
    monthlyFixedCosts,
    dailyFixedCost: t.custo_fixo_rateado,
    totalCost: t.custo_total,
    profit: t.lucro_total,
    profitPerHour: t.tempo_online_minutos > 0 ? t.lucro_total / (t.tempo_online_minutos / 60) : 0,
    profitPerKm: t.km_total > 0 ? t.lucro_total / t.km_total : 0,
    source: 'shift',
    shiftId: shift.turno_id,
  };
  upsertEntry(entry);
  return entry;
}

// Custo médio histórico (fallback quando não há veículo)
export function getCostPerKm(): number {
  const entries = getEntries().filter(e => e.kmDriven > 0).slice(0, 7);
  if (entries.length === 0) return 0;
  const totalCost = entries.reduce((s, e) => s + e.totalCost, 0);
  const totalKm = entries.reduce((s, e) => s + e.kmDriven, 0);
  return totalKm > 0 ? totalCost / totalKm : 0;
}

export function getShiftCostPerKm(shift: Shift | null | undefined): number {
  if (shift?.veiculo_id) {
    const v = getVehicleById(shift.veiculo_id);
    if (v) return vehicleCostPerKm(v);
  }
  return getCostPerKm();
}

export function getMinIdealKm(shift?: Shift | null): number {
  const cpk = getShiftCostPerKm(shift);
  const margin = getSettings().profitMargin || 1.3;
  return cpk * margin;
}

export function classifyRide(valor: number, km: number, shift?: Shift | null): { valor_por_km: number; resultado: RideResult } {
  const valor_por_km = km > 0 ? valor / km : 0;
  const cpk = getShiftCostPerKm(shift);
  const min = getMinIdealKm(shift);
  let resultado: RideResult;
  if (cpk <= 0) {
    resultado = valor_por_km >= 2 ? 'boa' : valor_por_km >= 1.2 ? 'aceitavel' : 'ruim';
  } else if (valor_por_km >= min) resultado = 'boa';
  else if (valor_por_km >= cpk) resultado = 'aceitavel';
  else resultado = 'ruim';
  return { valor_por_km, resultado };
}

export interface ShiftTotals {
  ganho_total: number;
  km_total: number;
  corridas_total: number;
  custo_combustivel: number;
  custo_fixo_rateado: number;
  custo_total: number;
  lucro_total: number;
  tempo_online_minutos: number;
  media_por_km: number;
  media_por_corrida: number;
}

function safeNum(n: number): number {
  return Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
}

/**
 * REGRA DE PRODUTO (MVP): custo fixo diário do veículo aplica UMA vez por
 * (veículo, data_operacional), no PRIMEIRO turno do dia. Determinístico.
 */
export function shouldApplyDailyFixedCost(shift: Shift): boolean {
  if (!shift.veiculo_id) return true;
  const siblings = getShifts()
    .filter(s =>
      s.veiculo_id === shift.veiculo_id &&
      s.data_operacional === shift.data_operacional
    )
    .sort((a, b) => a.inicio_turno.localeCompare(b.inicio_turno));
  return siblings[0]?.turno_id === shift.turno_id;
}

/**
 * computeTotals — PURA.
 *
 * Recebe as corridas canônicas (RideModel[]) do turno já resolvidas pelo
 * caller — não consulta Services, não consulta storage de corridas, não
 * importa RideService. Somente lê metadados imutáveis do próprio Shift
 * (km_gps, pausas, inicio/fim, veiculo_id) e do Vehicle vinculado.
 */
export function computeTotals(shift: Shift, rides: RideModel[]): ShiftTotals {
  const list = Array.isArray(rides) ? rides : [];
  const ganho_total = safeNum(list.reduce((s, r) => s + (r.value > 0 ? r.value : 0), 0));
  const km_corridas = safeNum(list.reduce((s, r) => s + (r.km > 0 ? r.km : 0), 0));
  const km_total = Math.max(km_corridas, safeNum(shift.km_gps || 0));
  const corridas_total = list.length;

  let v: Vehicle | null = null;
  if (shift.veiculo_id) v = getVehicleById(shift.veiculo_id);

  let custo_combustivel = 0;
  let custo_fixo_rateado = 0;
  if (v) {
    if (v.km_por_litro && v.km_por_litro > 0) {
      custo_combustivel = (km_total / v.km_por_litro) * (v.valor_combustivel_litro || 0);
    }
    custo_fixo_rateado = shouldApplyDailyFixedCost(shift)
      ? (v.custo_fixo_mensal || 0) / 30
      : 0;
  } else {
    custo_combustivel = getCostPerKm() * km_total;
  }
  const custo_total = safeNum(custo_combustivel + custo_fixo_rateado);
  const lucro_total = safeNum(ganho_total - custo_total);

  const fim = shift.fim_turno ? new Date(shift.fim_turno).getTime() : Date.now();
  const inicio = new Date(shift.inicio_turno).getTime();
  let pausado_ms = 0;
  (shift.pausas || []).forEach(p => {
    const ini = new Date(p.inicio).getTime();
    const f = p.fim ? new Date(p.fim).getTime() : Date.now();
    if (f > ini) pausado_ms += (f - ini);
  });
  const tempo_online_minutos = Math.max(0, Math.round((fim - inicio - pausado_ms) / 60000));
  const media_por_km = km_total > 0 ? safeNum(ganho_total / km_total) : 0;
  const media_por_corrida = corridas_total > 0 ? safeNum(ganho_total / corridas_total) : 0;
  return {
    ganho_total, km_total, corridas_total,
    custo_combustivel: safeNum(custo_combustivel),
    custo_fixo_rateado: safeNum(custo_fixo_rateado),
    custo_total, lucro_total, tempo_online_minutos, media_por_km, media_por_corrida,
  };
}

export function metaProgresso(shift: Shift, lucro: number): { meta: number; pct: number; faltam: number; atingida: boolean } {
  const meta = (typeof window !== 'undefined') ? (JSON.parse(localStorage.getItem('lucro-delivery-goals') || '{}').daily || 0) : 0;
  if (meta <= 0) return { meta: 0, pct: 0, faltam: 0, atingida: false };
  const pct = Math.min(100, Math.max(0, (lucro / meta) * 100));
  const faltam = Math.max(0, meta - lucro);
  return { meta, pct, faltam, atingida: lucro >= meta };
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
