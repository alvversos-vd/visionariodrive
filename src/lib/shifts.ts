import { markDirty } from './cloudSync';
import { getEntries, getSettings, upsertEntry } from './storage';
import { getVehicleById, vehicleCostPerKm, AppEntrega, Vehicle } from './vehicles';
import { DailyEntry } from './types';

const SHIFTS_KEY = 'lucro-delivery-shifts';

export type ShiftStatus = 'ativo' | 'pausado' | 'finalizado';
export type RideResult = 'boa' | 'aceitavel' | 'ruim';

export interface ShiftPause {
  inicio: string;
  fim?: string;
}

export interface RideEdit {
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
  resultado: RideResult;
  data_registro: string;
  data_operacional: string;
  edicoes?: RideEdit[];
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
  rides: ShiftRide[];
  km_gps?: number;
  km_desde_ultima_corrida?: number;
  ultima_corrida_iso?: string;
  pausas?: ShiftPause[];
  timezone?: string;
  tz_offset_minutos?: number;
  tz_offset_fim_minutos?: number;
  /** Status do GPS no turno — preservado no histórico para auditoria. */
  gps_status?: 'ok' | 'denied' | 'unavailable' | 'pending';
  /** Pontos brutos da rota capturados pelo GPS, para desenhar no mapa ao vivo
   *  e auditoria. Limitado a ~5000 pontos por turno (downsample antes disso). */
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

/** Acrescenta um ponto à rota do turno (batched — flush a cada 1.5s). */
export function appendRoutePoint(turno_id: string, pt: RoutePt): void {
  (_routeBuffer[turno_id] = _routeBuffer[turno_id] || []).push(pt);
  if (!_routeFlushTimer) _routeFlushTimer = setTimeout(flushRouteBuffer, ROUTE_FLUSH_MS);
}

/** Força flush imediato dos buffers (rota + distância) — usado ao pausar/encerrar. */
export function flushShiftBuffers(): void {
  if (_routeFlushTimer) { clearTimeout(_routeFlushTimer); flushRouteBuffer(); }
  if (_gpsFlushTimer) { clearTimeout(_gpsFlushTimer); flushGpsBuffer(); }
}

/** Apaga a rota (pontos GPS) de um turno específico, mantendo km/corridas. */
export function clearShiftRoute(turno_id: string): boolean {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return false;
  s.rota = [];
  saveShifts(list);
  return true;
}

/** Apaga a rota de TODOS os turnos (mantém histórico de corridas e km). */
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
  // Não rebaixa 'ok' já consolidado de volta para 'denied' (mantém histórico do melhor estado)
  if (s.gps_status === 'ok' && status !== 'ok') return;
  // Debounce: se o status já é o atual, evita write desnecessário (bateria/perf).
  if (s.gps_status === status) return;
  s.gps_status = status;
  saveShifts(list);
}

function getDeviceTz(): { tz: string; offset: number } {
  let tz = 'UTC';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch {}
  // offset em minutos no padrão "minutos ao leste de UTC" (oposto de Date.getTimezoneOffset)
  const offset = -new Date().getTimezoneOffset();
  return { tz, offset };
}

function operationalDateFromDate(d: Date): string {
  // Se for madrugada (00:00–04:59), a data operacional é o dia anterior.
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

// (Buffer de distância — declarado abaixo logo após o bloco de pausa/retomada de turno)

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
const GPS_FLUSH_MS = 1500;

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
    rides: [],
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
  // Mantém a data operacional do início (turnos que atravessam a madrugada
  // permanecem contabilizados no dia em que começaram), mas registra também
  // a data operacional do encerramento para histórico/auditoria.
  s.data_operacional_fim = operationalDateFromDate(now);
  saveShifts(list);

  // Bridge shift → entries (idempotente por shiftId): garante que Dashboard
  // e HistoryView reflitam o turno finalizado sem duplicar nem perder dados legados.
  try { upsertEntryFromShift(s); } catch { /* não bloqueia finalização */ }

  return s;
}

/**
 * Deriva um DailyEntry a partir do turno finalizado e faz upsert idempotente
 * por shiftId. Mantém compatibilidade total com entries manuais.
 */
export function upsertEntryFromShift(shift: Shift): DailyEntry {
  const t = computeTotals(shift);
  const v = shift.veiculo_id ? getVehicleById(shift.veiculo_id) : null;

  const fuelPrice = v?.valor_combustivel_litro || 0;
  const vehicleConsumption = v?.km_por_litro || 0;
  const monthlyFixedCosts = v?.custo_fixo_mensal || 0;
  const litersConsumed = vehicleConsumption > 0 ? t.km_total / vehicleConsumption : 0;
  const dailyFixedCost = monthlyFixedCosts / 30;

  // Usa data operacional ao meio-dia local para evitar deslocamento de fuso
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

export function addRide(turno_id: string, valor: number, km: number): ShiftRide | null {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s || s.status !== 'ativo') return null;
  const { valor_por_km, resultado } = classifyRide(valor, km, s);
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
  s.km_desde_ultima_corrida = 0;
  s.ultima_corrida_iso = ride.data_registro;
  saveShifts(list);
  return ride;
}

/** Registra corrida usando km do GPS auto-acumulado se km não informado. */
export function addRideAuto(turno_id: string, valor: number, kmManual?: number): ShiftRide | null {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return null;
  const km = kmManual && kmManual > 0 ? kmManual : (s.km_desde_ultima_corrida || 0);
  if (km <= 0) return null;
  return addRide(turno_id, valor, km);
}

export function deleteRide(turno_id: string, corrida_id: string) {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return;
  s.rides = s.rides.filter(r => r.corrida_id !== corrida_id);
  saveShifts(list);
}

/**
 * Restaura uma corrida previamente deletada, mantendo a ordem cronológica
 * com base em data_registro. Útil para o "Desfazer" após delete.
 */
export function restoreRide(turno_id: string, ride: ShiftRide): boolean {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return false;
  if (s.rides.some(r => r.corrida_id === ride.corrida_id)) return false;
  s.rides.push({ ...ride });
  // ordena desc por data_registro (mantém invariante usado na UI)
  s.rides.sort((a, b) => b.data_registro.localeCompare(a.data_registro));
  saveShifts(list);
  return true;
}

// Debounce de edições rápidas (evita race / flicker em totais)
const _editTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const EDIT_DEBOUNCE_MS = 250;

/**
 * Edita km e/ou valor de uma corrida já registrada, preservando histórico de edições
 * e os timestamps originais. Recalcula valor_por_km e resultado. Não altera ordem nem tempo.
 */
export function updateRide(
  turno_id: string,
  corrida_id: string,
  patch: { km?: number; valor?: number }
): ShiftRide | null {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return null;
  const r = s.rides.find(x => x.corrida_id === corrida_id);
  if (!r) return null;

  const nowIso = new Date().toISOString();
  r.edicoes = r.edicoes || [];

  if (typeof patch.km === 'number' && Number.isFinite(patch.km) && patch.km > 0 && patch.km !== r.km) {
    if (r.km_original === undefined) r.km_original = r.km;
    r.edicoes.push({ campo: 'km', valor_antigo: r.km, valor_novo: patch.km, data_edicao: nowIso });
    r.km = patch.km;
  }
  if (typeof patch.valor === 'number' && Number.isFinite(patch.valor) && patch.valor > 0 && patch.valor !== r.valor) {
    if (r.valor_original === undefined) r.valor_original = r.valor;
    r.edicoes.push({ campo: 'valor', valor_antigo: r.valor, valor_novo: patch.valor, data_edicao: nowIso });
    r.valor = patch.valor;
  }

  const cls = classifyRide(r.valor, r.km, s);
  r.valor_por_km = cls.valor_por_km;
  r.resultado = cls.resultado;

  // Coalesce writes para múltiplas edições rápidas na mesma corrida
  const key = `${turno_id}:${corrida_id}`;
  if (_editTimers[key]) clearTimeout(_editTimers[key]);
  _editTimers[key] = setTimeout(() => { delete _editTimers[key]; saveShifts(getShifts()); }, EDIT_DEBOUNCE_MS);
  saveShifts(list);
  return r;
}

/**
 * Reverte a última edição registrada em uma corrida (km ou valor) usando o
 * histórico em `edicoes`. Não remove o registro do histórico para manter rastreabilidade
 * — adiciona uma nova entrada inversa.
 */
export function revertLastEdit(turno_id: string, corrida_id: string): ShiftRide | null {
  const list = getShifts();
  const s = list.find(x => x.turno_id === turno_id);
  if (!s) return null;
  const r = s.rides.find(x => x.corrida_id === corrida_id);
  if (!r || !r.edicoes || r.edicoes.length === 0) return null;
  const last = r.edicoes[r.edicoes.length - 1];
  const nowIso = new Date().toISOString();
  if (last.campo === 'km') {
    r.edicoes.push({ campo: 'km', valor_antigo: r.km, valor_novo: last.valor_antigo, data_edicao: nowIso });
    r.km = last.valor_antigo;
  } else {
    r.edicoes.push({ campo: 'valor', valor_antigo: r.valor, valor_novo: last.valor_antigo, data_edicao: nowIso });
    r.valor = last.valor_antigo;
  }
  const cls = classifyRide(r.valor, r.km, s);
  r.valor_por_km = cls.valor_por_km;
  r.resultado = cls.resultado;
  saveShifts(list);
  return r;
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

export function computeTotals(shift: Shift): ShiftTotals {
  const ganho_total = safeNum(shift.rides.reduce((s, r) => s + (r.valor > 0 ? r.valor : 0), 0));
  const km_corridas = safeNum(shift.rides.reduce((s, r) => s + (r.km > 0 ? r.km : 0), 0));
  // Usa o maior entre km manual das corridas e km do GPS (anti-duplicação)
  const km_total = Math.max(km_corridas, safeNum(shift.km_gps || 0));
  const corridas_total = shift.rides.length;

  let v: Vehicle | null = null;
  if (shift.veiculo_id) v = getVehicleById(shift.veiculo_id);

  let custo_combustivel = 0;
  let custo_fixo_rateado = 0;
  if (v) {
    if (v.km_por_litro && v.km_por_litro > 0) {
      custo_combustivel = (km_total / v.km_por_litro) * (v.valor_combustivel_litro || 0);
    }
    custo_fixo_rateado = (v.custo_fixo_mensal || 0) / 30;
  } else {
    custo_combustivel = getCostPerKm() * km_total;
  }
  const custo_total = safeNum(custo_combustivel + custo_fixo_rateado);
  const lucro_total = safeNum(ganho_total - custo_total);

  const fim = shift.fim_turno ? new Date(shift.fim_turno).getTime() : Date.now();
  const inicio = new Date(shift.inicio_turno).getTime();
  // Desconta tempo pausado
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
