/**
 * CrmService — Sprint 6 · Fase 1.
 *
 * ÚNICA API pública para métricas administrativas. Consome crmRepository.
 * Não expõe PII: agrega tudo em contagens/médias. Nenhum e-mail,
 * coordenada ou valor identificável sai daqui.
 *
 * Reatividade: emite 'crm:changed' após load() concluir.
 */
import { crmRepository } from '../repositories/crmRepository';
import { eventBus } from '../eventBus';
import { crmAnalyticsService, type CrmAnalytics } from './crmAnalyticsService';
import { crmIntelligenceService, type CrmIntelligence } from './crmIntelligenceService';

export interface CrmKpis {
  totalUsers: number;
  activeToday: number;
  active7d: number;
  active30d: number;
  newToday: number;
  new7d: number;
  onboardedPct: number;
  proUsers: number;
  freeUsers: number;
  shiftsStartedToday: number;
  shiftsEndedToday: number;
  ridesTotal: number;
  ridesAuto: number;
  ridesManual: number;
  autoSharePct: number;
  totalKm: number;
  totalProfit: number;
  avgSessionMinutes: number;
  avgShiftMinutes: number;
}

export interface CrmSeriesPoint {
  date: string;         // YYYY-MM-DD
  signups: number;
  activeUsers: number;
}

export interface CrmSnapshot {
  generatedAt: string;
  kpis: CrmKpis;
  series30d: CrmSeriesPoint[];
  hourly24h: { hour: number; rides: number }[];
  /** Sprint 8 — CRM Intelligence (derivado, sem I/O adicional). */
  analytics: CrmAnalytics;
  /** Sprint 9 — Product Intelligence (derivado, sem I/O adicional). */
  intelligence: CrmIntelligence;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;

function safeArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const crmService = {
  /**
   * Carrega o snapshot completo do CRM. Retorna null quando o usuário
   * não é admin (RLS devolve listas vazias — tratamos como null).
   */
  async loadSnapshot(): Promise<CrmSnapshot> {
    const [profiles, userData] = await Promise.all([
      crmRepository.listProfiles(),
      crmRepository.listUserData(),
    ]);

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const t0 = startOfToday.getTime();
    const cut7 = t0 - 6 * DAY;
    const cut30 = t0 - 29 * DAY;

    // KPIs de usuários
    let activeToday = 0, active7d = 0, active30d = 0;
    let newToday = 0, new7d = 0;
    let onboarded = 0, pro = 0, free = 0;
    for (const p of profiles) {
      const login = p.ultimo_login ? new Date(p.ultimo_login).getTime() : 0;
      if (login >= t0) activeToday++;
      if (login >= cut7) active7d++;
      if (login >= cut30) active30d++;
      const created = new Date(p.created_at).getTime();
      if (created >= t0) newToday++;
      if (created >= cut7) new7d++;
      if (p.onboarding_completo) onboarded++;
      if (p.usuario_plano === 'PRO') pro++; else free++;
    }

    // Agregação de rides / shifts (JSONB)
    let ridesTotal = 0, ridesAuto = 0, ridesManual = 0;
    let totalKm = 0, totalProfit = 0;
    let shiftsStartedToday = 0, shiftsEndedToday = 0;
    let shiftMinutesSum = 0, shiftMinutesCount = 0;
    const hourly = new Array(24).fill(0);
    for (const u of userData) {
      const rides = safeArr(u.rides_v2 ?? u.rides);
      ridesTotal += rides.length;
      for (const r of rides as Record<string, unknown>[]) {
        const mode = String(r.captureMode ?? r.source ?? 'manual');
        if (mode === 'gps' || mode === 'auto') ridesAuto++; else ridesManual++;
        totalKm += num(r.km);
        totalProfit += num(r.profit ?? r.value);
        const ts = r.date ? new Date(String(r.date)).getTime() : NaN;
        if (Number.isFinite(ts)) {
          const h = new Date(ts).getHours();
          hourly[h]++;
        }
      }
      const shifts = safeArr(u.shifts);
      for (const s of shifts as Record<string, unknown>[]) {
        const start = s.startedAt ? new Date(String(s.startedAt)).getTime() : NaN;
        const end = s.endedAt ? new Date(String(s.endedAt)).getTime() : NaN;
        if (Number.isFinite(start) && start >= t0) shiftsStartedToday++;
        if (Number.isFinite(end) && end >= t0) shiftsEndedToday++;
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
          shiftMinutesSum += (end - start) / 60_000;
          shiftMinutesCount++;
        }
      }
    }

    // Série 30 dias — signups e usuários ativos por dia
    const bucketSignups = new Map<string, number>();
    const bucketActive = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(t0 - i * DAY);
      const key = ymd(d);
      bucketSignups.set(key, 0);
      bucketActive.set(key, 0);
    }
    for (const p of profiles) {
      const cKey = ymd(new Date(p.created_at));
      if (bucketSignups.has(cKey)) bucketSignups.set(cKey, (bucketSignups.get(cKey) ?? 0) + 1);
      if (p.ultimo_login) {
        const lKey = ymd(new Date(p.ultimo_login));
        if (bucketActive.has(lKey)) bucketActive.set(lKey, (bucketActive.get(lKey) ?? 0) + 1);
      }
    }
    const series30d: CrmSeriesPoint[] = Array.from(bucketSignups.keys()).map(k => ({
      date: k,
      signups: bucketSignups.get(k) ?? 0,
      activeUsers: bucketActive.get(k) ?? 0,
    }));

    const totalUsers = profiles.length;
    const kpis: CrmKpis = {
      totalUsers,
      activeToday,
      active7d,
      active30d,
      newToday,
      new7d,
      onboardedPct: totalUsers > 0 ? (onboarded / totalUsers) * 100 : 0,
      proUsers: pro,
      freeUsers: free,
      shiftsStartedToday,
      shiftsEndedToday,
      ridesTotal,
      ridesAuto,
      ridesManual,
      autoSharePct: ridesTotal > 0 ? (ridesAuto / ridesTotal) * 100 : 0,
      totalKm,
      totalProfit,
      avgSessionMinutes: 0, // não instrumentado ainda — reservado
      avgShiftMinutes: shiftMinutesCount > 0 ? shiftMinutesSum / shiftMinutesCount : 0,
    };

    const snapshot: CrmSnapshot = {
      generatedAt: new Date().toISOString(),
      kpis,
      series30d,
      hourly24h: hourly.map((rides, hour) => ({ hour, rides })),
      analytics: crmAnalyticsService.build(profiles, userData, now.getTime()),
      intelligence: crmIntelligenceService.build(profiles, userData, now.getTime()),
    };

    eventBus.emit('crm:changed');
    return snapshot;
  },

  async isAdmin(userId: string): Promise<boolean> {
    return crmRepository.isCurrentUserAdmin(userId);
  },
};

// silence unused import warning if HOUR not used
void HOUR;
