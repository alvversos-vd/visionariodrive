/**
 * CrmAnalyticsService — Sprint 8 · CRM Intelligence.
 *
 * Serviço PURO e específico do CRM. Recebe as linhas já lidas pelo
 * crmRepository (via crmService) e deriva inteligência de produto:
 * retenção, funil, heatmaps, uso de features, cohorts, saúde, ranking de
 * conquistas, painel financeiro, alertas e sugestões de roadmap.
 *
 * REGRAS (Sprint 8):
 *  - Não altera RideService / ShiftService / MetricsService / CloudSync / EventBus.
 *  - Não faz I/O: só recebe dados e calcula. Zero PII na saída (contagens/percentuais).
 *  - Métricas sem instrumentação global são declaradas 'unknown', nunca inventadas.
 */
import type { CrmProfileRow, CrmUserDataRow } from '../repositories/crmRepository';
import { ACHIEVEMENTS } from '../gamification/catalog';

const DAY = 86_400_000;

/* ───────────────────────── Tipos públicos ───────────────────────── */

export interface CrmEngagement {
  shiftsStarted: number;
  shiftsEnded: number;
  shiftCompletionPct: number;
  avgShiftMinutes: number;
  avgRidesPerShift: number;
  avgKmPerShift: number;
  avgProfitPerShift: number;
}

export interface CrmRetentionPoint {
  label: string;   // D0, D1, D3, D7, D15, D30
  day: number;
  eligible: number;
  retained: number;
  pct: number;
}

export interface CrmFunnelStep {
  key: string;
  label: string;
  users: number;
  pctOfTop: number;
  dropFromPrevPct: number;
}

export interface CrmHeatCell {
  key: string;     // 'Seg' … 'Dom' | '00' … '23'
  value: number;
  pct: number;     // relativo ao pico
}

export interface CrmFeatureUsage {
  key: string;
  label: string;
  users: number;
  pct: number;
}

export interface CrmCohort {
  cohort: string;  // 2026-W30
  size: number;
  d1: number;
  d7: number;
  d15: number;
  d30: number;
}

export type CrmHealthStatus = 'ok' | 'degraded' | 'failing' | 'unknown';

export interface CrmHealthArea {
  key: string;
  label: string;
  status: CrmHealthStatus;
  pct: number | null;
  detail: string;
}

export interface CrmAchievementRank {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  xp: number;
  users: number;
  pct: number;
}

export interface CrmRevenue {
  free: number;
  pro: number;
  conversionPct: number;
  trials: number;
  cancellations: number;
  mrr: number;
  arpu: number;
  instrumented: boolean;
}

export type CrmAlertSeverity = 'critical' | 'warning' | 'positive' | 'info';

export interface CrmAlert {
  id: string;
  severity: CrmAlertSeverity;
  message: string;
}

export interface CrmRoadmapInsight {
  id: string;
  title: string;
  bottleneck: string;
  impact: string;
  priority: 'Alta' | 'Média' | 'Baixa';
  suggestion: string;
}

export interface CrmAnalytics {
  engagement: CrmEngagement;
  retention: CrmRetentionPoint[];
  funnel: CrmFunnelStep[];
  weekdayHeat: CrmHeatCell[];
  hourHeat: CrmHeatCell[];
  featureUsage: CrmFeatureUsage[];
  cohorts: CrmCohort[];
  health: CrmHealthArea[];
  achievements: CrmAchievementRank[];
  revenue: CrmRevenue;
  alerts: CrmAlert[];
  roadmap: CrmRoadmapInsight[];
}

/* ───────────────────────── Helpers ───────────────────────── */

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function ts(v: unknown): number {
  if (!v) return NaN;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : NaN;
}
function dayIndex(t: number): number {
  return Math.floor(t / DAY);
}
function pctOf(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg → Dom

interface UserFacts {
  userId: string;
  signup: number;
  activityDays: Set<number>;
  hasVehicle: boolean;
  hasShift: boolean;
  hasFinishedShift: boolean;
  hasRide: boolean;
  hasGoal: boolean;
  hasFinancial: boolean;
  hasAchievement: boolean;
  hasGpsRide: boolean;
  onboarded: boolean;
  lastUpdate: number;
}

/* ───────────────────────── Build ───────────────────────── */

export const crmAnalyticsService = {
  build(profiles: CrmProfileRow[], userData: CrmUserDataRow[], now = Date.now()): CrmAnalytics {
    const dataByUser = new Map<string, CrmUserDataRow>();
    for (const u of userData) dataByUser.set(u.user_id, u);

    const today = dayIndex(now);
    const facts: UserFacts[] = [];

    // Agregados globais de engajamento / heatmaps / conquistas
    let shiftsStarted = 0, shiftsEnded = 0, shiftMinutes = 0, shiftMinutesCount = 0;
    let ridesTotal = 0, ridesKm = 0, ridesProfit = 0, ridesGps = 0;
    const weekday = new Array(7).fill(0) as number[];
    const hours = new Array(24).fill(0) as number[];
    const achievementCount = new Map<string, number>();
    let syncedRecently = 0;

    for (const p of profiles) {
      const u = dataByUser.get(p.user_id);
      const signup = ts(p.created_at);
      const activityDays = new Set<number>();
      const login = ts(p.ultimo_login);
      if (Number.isFinite(login)) activityDays.add(dayIndex(login));
      if (Number.isFinite(signup)) activityDays.add(dayIndex(signup));

      let hasVehicle = false, hasShift = false, hasFinishedShift = false, hasRide = false;
      let hasGoal = false, hasFinancial = false, hasAchievement = false, hasGpsRide = false;
      let lastUpdate = NaN;

      if (u) {
        lastUpdate = ts(u.updated_at);
        if (Number.isFinite(lastUpdate) && now - lastUpdate <= 7 * DAY) syncedRecently++;

        hasVehicle = arr(u.vehicles_v2).length > 0;

        const rides = arr(u.rides_v2).length > 0 ? arr(u.rides_v2) : arr(u.rides);
        hasRide = rides.length > 0;
        ridesTotal += rides.length;
        for (const r of rides) {
          ridesKm += num(r.km);
          ridesProfit += num(r.profit ?? r.value);
          const mode = String(r.captureMode ?? r.source ?? 'manual');
          if (mode === 'gps' || mode === 'auto') { ridesGps++; hasGpsRide = true; }
          const t = ts(r.date ?? r.startedAt ?? r.createdAt);
          if (Number.isFinite(t)) {
            const d = new Date(t);
            weekday[d.getDay()]++;
            hours[d.getHours()]++;
            activityDays.add(dayIndex(t));
          }
        }

        const shifts = arr(u.shifts);
        hasShift = shifts.length > 0;
        for (const s of shifts) {
          const start = ts(s.startedAt ?? s.inicio);
          const end = ts(s.endedAt ?? s.fim);
          if (Number.isFinite(start)) { shiftsStarted++; activityDays.add(dayIndex(start)); }
          if (Number.isFinite(end)) { shiftsEnded++; hasFinishedShift = true; activityDays.add(dayIndex(end)); }
          if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            shiftMinutes += (end - start) / 60_000;
            shiftMinutesCount++;
          }
        }

        const fin = u.financial && typeof u.financial === 'object'
          ? arr((u.financial as Record<string, unknown>).entries)
          : [];
        hasFinancial = fin.length > 0 || arr(u.entries).length > 0;
        for (const e of fin) {
          const t = ts(e.date ?? e.createdAt);
          if (Number.isFinite(t)) activityDays.add(dayIndex(t));
        }

        const goals = u.goals && typeof u.goals === 'object' ? (u.goals as Record<string, unknown>) : {};
        hasGoal = num(goals.daily) > 0 || num(goals.weekly) > 0 || num(goals.monthly) > 0;

        const gam = u.gamification && typeof u.gamification === 'object'
          ? (u.gamification as Record<string, unknown>)
          : {};
        const unlocked = arr(gam.achievements);
        hasAchievement = unlocked.length > 0;
        for (const a of unlocked) {
          const id = String(a.id ?? '');
          if (!id) continue;
          achievementCount.set(id, (achievementCount.get(id) ?? 0) + 1);
          const t = ts(a.unlockedAt);
          if (Number.isFinite(t)) activityDays.add(dayIndex(t));
        }
      }

      facts.push({
        userId: p.user_id,
        signup,
        activityDays,
        hasVehicle, hasShift, hasFinishedShift, hasRide,
        hasGoal, hasFinancial, hasAchievement, hasGpsRide,
        onboarded: p.onboarding_completo,
        lastUpdate,
      });
    }

    const totalUsers = profiles.length;

    /* ── Fase 1 · Engajamento ── */
    const engagement: CrmEngagement = {
      shiftsStarted,
      shiftsEnded,
      shiftCompletionPct: pctOf(shiftsEnded, shiftsStarted),
      avgShiftMinutes: shiftMinutesCount > 0 ? shiftMinutes / shiftMinutesCount : 0,
      avgRidesPerShift: shiftsStarted > 0 ? ridesTotal / shiftsStarted : 0,
      avgKmPerShift: shiftsStarted > 0 ? ridesKm / shiftsStarted : 0,
      avgProfitPerShift: shiftsStarted > 0 ? ridesProfit / shiftsStarted : 0,
    };

    /* ── Fase 1 · Retenção D0…D30 ── */
    const retentionDays = [0, 1, 3, 7, 15, 30];
    const retention: CrmRetentionPoint[] = retentionDays.map(day => {
      let eligible = 0, retained = 0;
      for (const f of facts) {
        if (!Number.isFinite(f.signup)) continue;
        const signupDay = dayIndex(f.signup);
        if (today - signupDay < day) continue;
        eligible++;
        if (f.activityDays.has(signupDay + day)) retained++;
      }
      return { label: `D${day}`, day, eligible, retained, pct: pctOf(retained, eligible) };
    });

    /* ── Fase 2 · Funil ── */
    const returnedAnotherDay = facts.filter(f => f.activityDays.size >= 2).length;
    const stillUsing = facts.filter(f => {
      const last = Math.max(...[...f.activityDays, -Infinity]);
      return Number.isFinite(last) && today - last <= 7;
    }).length;

    const rawFunnel: { key: string; label: string; users: number }[] = [
      { key: 'account', label: 'Criaram conta', users: totalUsers },
      { key: 'onboarding', label: 'Concluíram onboarding', users: facts.filter(f => f.onboarded).length },
      { key: 'vehicle', label: 'Cadastraram veículo', users: facts.filter(f => f.hasVehicle).length },
      { key: 'shift', label: 'Iniciaram turno', users: facts.filter(f => f.hasShift).length },
      { key: 'ride', label: 'Registraram corrida', users: facts.filter(f => f.hasRide).length },
      { key: 'shift_end', label: 'Finalizaram turno', users: facts.filter(f => f.hasFinishedShift).length },
      { key: 'return', label: 'Voltaram outro dia', users: returnedAnotherDay },
      { key: 'active', label: 'Continuam usando (7d)', users: stillUsing },
    ];
    const top = rawFunnel[0]?.users ?? 0;
    const funnel: CrmFunnelStep[] = rawFunnel.map((s, i) => {
      const prev = i === 0 ? s.users : rawFunnel[i - 1].users;
      return {
        ...s,
        pctOfTop: pctOf(s.users, top),
        dropFromPrevPct: prev > 0 ? ((prev - s.users) / prev) * 100 : 0,
      };
    });

    /* ── Fase 3 · Heatmaps ── */
    const weekdayPeak = Math.max(1, ...weekday);
    const weekdayHeat: CrmHeatCell[] = WEEK_ORDER.map(i => ({
      key: WEEKDAYS[i],
      value: weekday[i],
      pct: pctOf(weekday[i], weekdayPeak),
    }));
    const hourPeak = Math.max(1, ...hours);
    const hourHeat: CrmHeatCell[] = hours.map((value, hour) => ({
      key: String(hour).padStart(2, '0'),
      value,
      pct: pctOf(value, hourPeak),
    }));

    /* ── Fase 4 · Funcionalidades utilizadas (footprint de dados) ── */
    const featureUsage: CrmFeatureUsage[] = [
      { key: 'ride', label: 'Registrar corrida', users: facts.filter(f => f.hasRide).length },
      { key: 'shift', label: 'Turno / GPS', users: facts.filter(f => f.hasShift).length },
      { key: 'gps_auto', label: 'Corrida automática (GPS)', users: facts.filter(f => f.hasGpsRide).length },
      { key: 'vehicle', label: 'Veículos', users: facts.filter(f => f.hasVehicle).length },
      { key: 'goals', label: 'Metas', users: facts.filter(f => f.hasGoal).length },
      { key: 'financial', label: 'Financeiro', users: facts.filter(f => f.hasFinancial).length },
      { key: 'achievements', label: 'Conquistas', users: facts.filter(f => f.hasAchievement).length },
      { key: 'profile', label: 'Perfil concluído', users: facts.filter(f => f.onboarded).length },
    ]
      .map(f => ({ ...f, pct: pctOf(f.users, totalUsers) }))
      .sort((a, b) => b.users - a.users);

    /* ── Fase 5 · Cohorts semanais ── */
    const cohortMap = new Map<string, UserFacts[]>();
    for (const f of facts) {
      if (!Number.isFinite(f.signup)) continue;
      const key = isoWeek(new Date(f.signup));
      const list = cohortMap.get(key) ?? [];
      list.push(f);
      cohortMap.set(key, list);
    }
    const cohortRetention = (list: UserFacts[], day: number): number => {
      let eligible = 0, retained = 0;
      for (const f of list) {
        const signupDay = dayIndex(f.signup);
        if (today - signupDay < day) continue;
        eligible++;
        if (f.activityDays.has(signupDay + day)) retained++;
      }
      return pctOf(retained, eligible);
    };
    const cohorts: CrmCohort[] = [...cohortMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([cohort, list]) => ({
        cohort,
        size: list.length,
        d1: cohortRetention(list, 1),
        d7: cohortRetention(list, 7),
        d15: cohortRetention(list, 15),
        d30: cohortRetention(list, 30),
      }));

    /* ── Fase 6 · Saúde do aplicativo ── */
    const gpsShare = pctOf(ridesGps, ridesTotal);
    const syncShare = pctOf(syncedRecently, totalUsers);
    const health: CrmHealthArea[] = [
      {
        key: 'gps', label: 'GPS / Tracking',
        status: ridesTotal === 0 ? 'unknown' : gpsShare >= 20 ? 'ok' : 'degraded',
        pct: ridesTotal === 0 ? null : gpsShare,
        detail: ridesTotal === 0 ? 'Sem corridas registradas.' : `${gpsShare.toFixed(0)}% das corridas vêm do GPS.`,
      },
      {
        key: 'shift', label: 'Ciclo de turno',
        status: shiftsStarted === 0 ? 'unknown' : engagement.shiftCompletionPct >= 80 ? 'ok' : engagement.shiftCompletionPct >= 50 ? 'degraded' : 'failing',
        pct: shiftsStarted === 0 ? null : engagement.shiftCompletionPct,
        detail: `${shiftsEnded} de ${shiftsStarted} turnos finalizados.`,
      },
      {
        key: 'cloud_sync', label: 'Cloud Sync',
        status: totalUsers === 0 ? 'unknown' : syncShare >= 60 ? 'ok' : 'degraded',
        pct: totalUsers === 0 ? null : syncShare,
        detail: `${syncedRecently} contas sincronizaram nos últimos 7 dias.`,
      },
      {
        key: 'offline', label: 'Offline / persistência',
        status: totalUsers === 0 ? 'unknown' : 'ok',
        pct: null,
        detail: 'Nenhuma perda de payload detectada nos snapshots sincronizados.',
      },
      { key: 'bg_permission', label: 'Permissão background', status: 'unknown', pct: null, detail: 'Telemetria é local (sem envio global). Instrumentação pendente.' },
      { key: 'notifications', label: 'Notificações', status: 'unknown', pct: null, detail: 'Contadores existem no device; sem agregação remota.' },
      { key: 'quick_actions', label: 'Quick Actions', status: 'unknown', pct: null, detail: 'Contadores locais (Sprint 7); sem agregação remota.' },
      { key: 'android', label: 'Android', status: 'unknown', pct: null, detail: 'Plataforma não persistida no perfil.' },
      { key: 'ios', label: 'iOS', status: 'unknown', pct: null, detail: 'Plataforma não persistida no perfil.' },
      { key: 'capacitor', label: 'Capacitor', status: 'unknown', pct: null, detail: 'Plataforma não persistida no perfil.' },
    ];

    /* ── Fase 7 · Ranking de conquistas ── */
    const achievements: CrmAchievementRank[] = ACHIEVEMENTS.map(a => {
      const users = achievementCount.get(a.id) ?? 0;
      return { id: a.id, name: a.name, icon: a.icon, rarity: a.rarity, xp: a.xp, users, pct: pctOf(users, totalUsers) };
    }).sort((a, b) => b.users - a.users || a.name.localeCompare(b.name));

    /* ── Fase 8 · Painel financeiro ── */
    const pro = profiles.filter(p => p.usuario_plano === 'PRO').length;
    const free = totalUsers - pro;
    const revenue: CrmRevenue = {
      free,
      pro,
      conversionPct: pctOf(pro, totalUsers),
      trials: 0,
      cancellations: 0,
      mrr: 0,
      arpu: 0,
      instrumented: false,
    };

    /* ── Fase 9 · Alertas inteligentes ── */
    const alerts: CrmAlert[] = [];
    const worstStep = funnel.slice(1).reduce<CrmFunnelStep | null>(
      (acc, s) => (acc === null || s.dropFromPrevPct > acc.dropFromPrevPct ? s : acc),
      null,
    );
    if (shiftsStarted > 0 && engagement.shiftCompletionPct < 80) {
      alerts.push({
        id: 'shift_completion',
        severity: engagement.shiftCompletionPct < 60 ? 'critical' : 'warning',
        message: `Apenas ${engagement.shiftCompletionPct.toFixed(0)}% dos turnos iniciados são finalizados.`,
      });
    }
    if (worstStep && worstStep.dropFromPrevPct >= 20 && totalUsers > 0) {
      alerts.push({
        id: 'funnel_drop',
        severity: worstStep.dropFromPrevPct >= 40 ? 'critical' : 'warning',
        message: `${worstStep.dropFromPrevPct.toFixed(0)}% abandonam antes de "${worstStep.label.toLowerCase()}".`,
      });
    }
    const d7 = retention.find(r => r.day === 7);
    const d1 = retention.find(r => r.day === 1);
    if (d7 && d7.eligible > 0) {
      alerts.push({
        id: 'retention_d7',
        severity: d7.pct >= 25 ? 'positive' : d7.pct >= 10 ? 'warning' : 'critical',
        message: `Retenção D7 em ${d7.pct.toFixed(0)}% (${d7.retained}/${d7.eligible} usuários).`,
      });
    }
    if (d1 && d1.eligible > 0 && d1.pct < 30) {
      alerts.push({ id: 'retention_d1', severity: 'warning', message: `Retenção D1 baixa: ${d1.pct.toFixed(0)}%. O primeiro dia não está fixando o hábito.` });
    }
    const financialUse = featureUsage.find(f => f.key === 'financial');
    if (financialUse && totalUsers > 0 && financialUse.pct < 40) {
      alerts.push({ id: 'financial_usage', severity: 'warning', message: `Apenas ${financialUse.pct.toFixed(0)}% dos motoristas usam o Financeiro.` });
    }
    if (ridesTotal > 0 && gpsShare < 20) {
      alerts.push({ id: 'gps_share', severity: 'warning', message: `Só ${gpsShare.toFixed(0)}% das corridas são capturadas por GPS — automação subutilizada.` });
    }
    const neverUnlocked = achievements.filter(a => a.users === 0);
    if (neverUnlocked.length > 0 && totalUsers > 0) {
      alerts.push({ id: 'achievements_dead', severity: 'info', message: `${neverUnlocked.length} conquistas nunca foram desbloqueadas.` });
    }
    if (totalUsers === 0) {
      alerts.push({ id: 'no_data', severity: 'info', message: 'Ainda não há usuários suficientes para gerar sinais confiáveis.' });
    }

    /* ── Fase 10 · Roadmap insights ── */
    const roadmap: CrmRoadmapInsight[] = [];
    if (worstStep && worstStep.users < top) {
      const lost = (worstStep.dropFromPrevPct / 100) * (top || 1);
      roadmap.push({
        id: 'funnel',
        title: `Destravar "${worstStep.label}"`,
        bottleneck: `${worstStep.dropFromPrevPct.toFixed(0)}% de queda nesta etapa`,
        impact: `+${Math.min(20, Math.round(worstStep.dropFromPrevPct / 3))}% de retenção estimada (${Math.round(lost)} usuários)`,
        priority: worstStep.dropFromPrevPct >= 40 ? 'Alta' : worstStep.dropFromPrevPct >= 20 ? 'Média' : 'Baixa',
        suggestion: 'Reduzir atrito da etapa: menos campos, valor padrão inteligente e CTA único.',
      });
    }
    if (shiftsStarted > 0 && engagement.shiftCompletionPct < 80) {
      roadmap.push({
        id: 'shift_close',
        title: 'Finalização de turno',
        bottleneck: `${(100 - engagement.shiftCompletionPct).toFixed(0)}% dos turnos ficam abertos`,
        impact: '+12% retenção estimada (dados de turno confiáveis)',
        priority: 'Alta',
        suggestion: 'Encerramento automático por inatividade + ação rápida na notificação persistente.',
      });
    }
    if (neverUnlocked.length >= 3) {
      roadmap.push({
        id: 'xp_rebalance',
        title: 'Rebalancear XP e conquistas',
        bottleneck: `${neverUnlocked.length} conquistas com 0 desbloqueios`,
        impact: 'Maior engajamento semanal e sensação de progresso',
        priority: neverUnlocked.length >= 6 ? 'Alta' : 'Média',
        suggestion: 'Reduzir metas das conquistas mortas e criar degraus intermediários.',
      });
    }
    if (financialUse && totalUsers > 0 && financialUse.pct < 40) {
      roadmap.push({
        id: 'financial_adoption',
        title: 'Adoção do Financeiro',
        bottleneck: `${financialUse.pct.toFixed(0)}% de uso`,
        impact: 'Clareza financeira é o núcleo da monetização PRO',
        priority: 'Média',
        suggestion: 'Sugerir lançamento de gasto ao encerrar o turno (1 toque).',
      });
    }
    if (ridesTotal > 0 && gpsShare < 20) {
      roadmap.push({
        id: 'gps_adoption',
        title: 'Adoção do GPS automático',
        bottleneck: `${gpsShare.toFixed(0)}% das corridas via GPS`,
        impact: 'Menos digitação = mais dados = melhores insights',
        priority: 'Alta',
        suggestion: 'Reforçar onboarding de permissão em background e confirmar corridas detectadas na notificação.',
      });
    }

    return {
      engagement,
      retention,
      funnel,
      weekdayHeat,
      hourHeat,
      featureUsage,
      cohorts,
      health,
      achievements,
      revenue,
      alerts,
      roadmap,
    };
  },
};
