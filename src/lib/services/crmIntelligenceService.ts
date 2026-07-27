/**
 * CrmIntelligenceService — Sprint 9 · Product Intelligence.
 *
 * Serviço PURO e específico do CRM (camada Service). Recebe as linhas já
 * lidas pelo crmRepository (via crmService) e transforma dados em AÇÕES:
 * Driver Score, Churn Prediction, Segmentação, Recomendações automáticas,
 * Feature Adoption (evolução semanal), Experimentos (comparação por versão),
 * Product Health e Customer Journey.
 *
 * REGRAS (imutáveis desde a Sprint 8):
 *  - Não altera RideService / ShiftService / MetricsService / CloudSync / EventBus.
 *  - Não faz I/O: recebe dados e calcula.
 *  - Zero PII na saída: usuários aparecem apenas como alias derivado do id.
 *  - Métrica sem instrumentação é declarada `instrumented: false`, nunca inventada.
 */
import type { CrmProfileRow, CrmUserDataRow } from '../repositories/crmRepository';

const DAY = 86_400_000;

/* ───────────────────────── Tipos públicos ───────────────────────── */

export interface CrmScoreBreakdown {
  frequency: number;
  retention: number;
  shifts: number;
  rides: number;
  goals: number;
  xp: number;
}

export interface CrmDriverScore {
  userId: string;
  alias: string;
  score: number;
  tier: 'excelente' | 'saudável' | 'atenção' | 'crítico';
  lastActivityDays: number | null;
  breakdown: CrmScoreBreakdown;
}

export interface CrmChurnRisk {
  userId: string;
  alias: string;
  riskPct: number;
  lastActivityDays: number | null;
  reasons: string[];
}

export interface CrmSegment {
  key: string;
  label: string;
  users: number;
  pct: number;
  description: string;
}

export interface CrmRecommendation {
  id: string;
  title: string;
  evidence: string;
  action: string;
  priority: 'Alta' | 'Média' | 'Baixa';
}

export interface CrmAdoptionTrend {
  key: string;
  label: string;
  prevPct: number;
  currPct: number;
  deltaPct: number;
  prevUsers: number;
  currUsers: number;
}

export interface CrmExperimentArm {
  version: string;
  users: number;
  retentionD7: number;
  shiftCompletionPct: number;
  ridesPerUser: number;
}

export interface CrmExperiments {
  instrumented: boolean;
  note: string;
  arms: CrmExperimentArm[];
}

export interface CrmHealthComponent {
  key: string;
  label: string;
  value: number | null;
  weight: number;
  instrumented: boolean;
}

export interface CrmProductHealth {
  score: number;
  delta: number;
  components: CrmHealthComponent[];
}

export interface CrmJourneyStage {
  key: string;
  label: string;
  users: number;
  pctOfTop: number;
  dropFromPrevPct: number;
  instrumented: boolean;
}

export interface CrmIntelligence {
  scores: CrmDriverScore[];
  avgScore: number;
  churnRisks: CrmChurnRisk[];
  atRiskUsers: number;
  segments: CrmSegment[];
  recommendations: CrmRecommendation[];
  adoption: CrmAdoptionTrend[];
  experiments: CrmExperiments;
  productHealth: CrmProductHealth;
  journey: CrmJourneyStage[];
}

/* ───────────────────────── Helpers ───────────────────────── */

function arr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
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
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
/** Alias determinístico, sem PII: "Motorista #a1b2". */
function aliasOf(userId: string): string {
  return `Motorista #${userId.replace(/-/g, '').slice(0, 4)}`;
}

interface Facts {
  userId: string;
  alias: string;
  signup: number;
  onboarded: boolean;
  plan: 'FREE' | 'PRO';
  activityDays: Set<number>;
  lastActivity: number;
  ridesTotal: number;
  ridesGps: number;
  ridesQuick: number;
  ridesManual: number;
  shiftsStarted: number;
  shiftsEnded: number;
  hasVehicle: boolean;
  hasGoal: boolean;
  hasFinancial: boolean;
  xp: number;
  /** timestamps por feature, para janelas semanais */
  featureTimes: Record<string, number[]>;
}

const FEATURES: { key: string; label: string }[] = [
  { key: 'ride', label: 'Registrar corrida' },
  { key: 'gps', label: 'GPS automático' },
  { key: 'quick_actions', label: 'Quick Actions' },
  { key: 'shift', label: 'Turno' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'goals', label: 'Metas' },
];

/* ───────────────────────── Build ───────────────────────── */

export const crmIntelligenceService = {
  build(profiles: CrmProfileRow[], userData: CrmUserDataRow[], now = Date.now()): CrmIntelligence {
    const byUser = new Map<string, CrmUserDataRow>();
    for (const u of userData) byUser.set(u.user_id, u);
    const today = dayIndex(now);

    const facts: Facts[] = profiles.map(p => {
      const u = byUser.get(p.user_id);
      const signup = ts(p.created_at);
      const activityDays = new Set<number>();
      const featureTimes: Record<string, number[]> = {
        ride: [], gps: [], quick_actions: [], shift: [], financial: [], goals: [],
      };
      let lastActivity = NaN;
      const touch = (t: number, feature?: string) => {
        if (!Number.isFinite(t)) return;
        activityDays.add(dayIndex(t));
        if (!Number.isFinite(lastActivity) || t > lastActivity) lastActivity = t;
        if (feature) featureTimes[feature].push(t);
      };

      const login = ts(p.ultimo_login);
      touch(login);
      touch(signup);

      let ridesTotal = 0, ridesGps = 0, ridesQuick = 0, ridesManual = 0;
      let shiftsStarted = 0, shiftsEnded = 0;
      let hasVehicle = false, hasGoal = false, hasFinancial = false;
      let xp = 0;

      if (u) {
        hasVehicle = arr(u.vehicles_v2).length > 0;

        const rides = arr(u.rides_v2).length > 0 ? arr(u.rides_v2) : arr(u.rides);
        ridesTotal = rides.length;
        for (const r of rides) {
          const mode = String(r.captureMode ?? r.source ?? 'manual');
          const t = ts(r.date ?? r.startedAt ?? r.createdAt);
          touch(t, 'ride');
          if (mode === 'gps' || mode === 'auto') { ridesGps++; touch(t, 'gps'); }
          else if (mode === 'quick') { ridesQuick++; touch(t, 'quick_actions'); }
          else ridesManual++;
        }

        for (const s of arr(u.shifts)) {
          const start = ts(s.startedAt ?? s.inicio);
          const end = ts(s.endedAt ?? s.fim);
          if (Number.isFinite(start)) { shiftsStarted++; touch(start, 'shift'); }
          if (Number.isFinite(end)) { shiftsEnded++; touch(end, 'shift'); }
        }

        const fin = arr(obj(u.financial).entries);
        const legacy = arr(u.entries);
        hasFinancial = fin.length > 0 || legacy.length > 0;
        for (const e of [...fin, ...legacy]) touch(ts(e.date ?? e.createdAt), 'financial');

        const goals = obj(u.goals);
        hasGoal = num(goals.daily) > 0 || num(goals.weekly) > 0 || num(goals.monthly) > 0;
        if (hasGoal) {
          const t = ts(u.updated_at);
          if (Number.isFinite(t)) featureTimes.goals.push(t);
        }

        xp = num(obj(obj(u.gamification).xp).totalXp);
        for (const a of arr(obj(u.gamification).achievements)) touch(ts(a.unlockedAt));
      }

      return {
        userId: p.user_id,
        alias: aliasOf(p.user_id),
        signup,
        onboarded: p.onboarding_completo,
        plan: p.usuario_plano,
        activityDays,
        lastActivity,
        ridesTotal, ridesGps, ridesQuick, ridesManual,
        shiftsStarted, shiftsEnded,
        hasVehicle, hasGoal, hasFinancial,
        xp,
        featureTimes,
      };
    });

    const totalUsers = facts.length;
    const daysSince = (f: Facts): number | null =>
      Number.isFinite(f.lastActivity) ? Math.max(0, today - dayIndex(f.lastActivity)) : null;

    /* ── Driver Score ──
       Índice 0–100 para IDENTIFICAR RISCO, não para ranquear pessoas. */
    const scores: CrmDriverScore[] = facts.map(f => {
      const active30 = [...f.activityDays].filter(d => today - d <= 29 && today - d >= 0).length;
      const since = daysSince(f);
      const breakdown: CrmScoreBreakdown = {
        frequency: clamp01(active30 / 12) * 25,
        retention: (since === null ? 0 : clamp01(1 - since / 14)) * 25,
        shifts: clamp01(f.shiftsEnded / 10) * 15,
        rides: clamp01(f.ridesTotal / 30) * 15,
        goals: (f.hasGoal ? 1 : 0) * 10,
        xp: clamp01(f.xp / 1500) * 10,
      };
      const score = round(
        breakdown.frequency + breakdown.retention + breakdown.shifts +
        breakdown.rides + breakdown.goals + breakdown.xp,
      );
      const tier: CrmDriverScore['tier'] =
        score >= 75 ? 'excelente' : score >= 50 ? 'saudável' : score >= 25 ? 'atenção' : 'crítico';
      return { userId: f.userId, alias: f.alias, score, tier, lastActivityDays: since, breakdown };
    }).sort((a, b) => b.score - a.score);

    const avgScore = totalUsers > 0 ? round(scores.reduce((s, x) => s + x.score, 0) / totalUsers) : 0;

    /* ── Churn Prediction ──
       Risco = complemento do score, com reforço por sinais de abandono. */
    const scoreById = new Map(scores.map(s => [s.userId, s]));
    const churnRisks: CrmChurnRisk[] = facts.map(f => {
      const s = scoreById.get(f.userId)!;
      const since = s.lastActivityDays;
      const reasons: string[] = [];
      let risk = 100 - s.score;

      if (since !== null && since >= 7) { reasons.push(`Último turno/atividade há ${since} dias.`); risk += Math.min(20, (since - 6) * 2); }
      else if (since !== null && since >= 3) reasons.push(`Sem atividade há ${since} dias.`);
      if (!f.hasFinancial) { reasons.push('Nunca abriu o Financeiro.'); risk += 5; }
      if (!f.hasGoal) { reasons.push('Nunca criou metas.'); risk += 5; }
      if (!f.hasVehicle) { reasons.push('Nunca cadastrou veículo.'); risk += 5; }
      if (f.shiftsStarted > 0 && f.shiftsEnded === 0) { reasons.push('Nunca finalizou um turno.'); risk += 5; }
      if (f.ridesTotal === 0) { reasons.push('Nenhuma corrida registrada.'); risk += 5; }
      if (!f.onboarded) { reasons.push('Onboarding incompleto.'); risk += 5; }

      return {
        userId: f.userId,
        alias: f.alias,
        riskPct: Math.max(0, Math.min(99, round(risk))),
        lastActivityDays: since,
        reasons,
      };
    }).sort((a, b) => b.riskPct - a.riskPct);

    const atRiskUsers = churnRisks.filter(c => c.riskPct >= 60).length;

    /* ── Segmentação ── */
    const isNew = (f: Facts) => Number.isFinite(f.signup) && today - dayIndex(f.signup) <= 14;
    const isVeteran = (f: Facts) => Number.isFinite(f.signup) && today - dayIndex(f.signup) > 60;
    const activeDays7 = (f: Facts) => [...f.activityDays].filter(d => today - d <= 6 && today - d >= 0).length;

    const segDefs: { key: string; label: string; description: string; match: (f: Facts) => boolean }[] = [
      { key: 'novatos', label: 'Novatos', description: 'Cadastro nos últimos 14 dias.', match: isNew },
      { key: 'veteranos', label: 'Veteranos', description: 'Mais de 60 dias de conta.', match: isVeteran },
      { key: 'muito_ativos', label: 'Muito ativos', description: '4+ dias ativos na última semana.', match: f => activeDays7(f) >= 4 },
      { key: 'risco', label: 'Risco de abandono', description: 'Score de churn ≥ 60%.', match: f => (churnRisks.find(c => c.userId === f.userId)?.riskPct ?? 0) >= 60 },
      { key: 'usa_gps', label: 'Usa GPS', description: 'Pelo menos uma corrida capturada por GPS.', match: f => f.ridesGps > 0 },
      { key: 'sem_gps', label: 'Não usa GPS', description: 'Registra corridas, mas nunca por GPS.', match: f => f.ridesTotal > 0 && f.ridesGps === 0 },
      { key: 'so_manual', label: 'Só usa manual', description: 'Todas as corridas digitadas manualmente.', match: f => f.ridesTotal > 0 && f.ridesManual === f.ridesTotal },
      { key: 'so_quick', label: 'Só usa Quick Actions', description: 'Todas as corridas vieram da notificação.', match: f => f.ridesTotal > 0 && f.ridesQuick === f.ridesTotal },
      { key: 'usa_financeiro', label: 'Usa Financeiro', description: 'Tem lançamentos financeiros.', match: f => f.hasFinancial },
      { key: 'sem_financeiro', label: 'Não usa Financeiro', description: 'Nenhum lançamento financeiro.', match: f => !f.hasFinancial },
    ];
    const segments: CrmSegment[] = segDefs.map(s => {
      const users = facts.filter(s.match).length;
      return { key: s.key, label: s.label, users, pct: pctOf(users, totalUsers), description: s.description };
    });
    const segUsers = (key: string) => segments.find(s => s.key === key)?.users ?? 0;
    const segPct = (key: string) => segments.find(s => s.key === key)?.pct ?? 0;

    /* ── Feature Adoption (semana atual × semana anterior) ── */
    const currFrom = now - 7 * DAY;
    const prevFrom = now - 14 * DAY;
    const activeCurr = facts.filter(f => Number.isFinite(f.lastActivity) && f.lastActivity >= currFrom).length;
    const activePrev = facts.filter(f => Number.isFinite(f.lastActivity) && f.lastActivity >= prevFrom && f.lastActivity < currFrom).length;

    const adoption: CrmAdoptionTrend[] = FEATURES.map(({ key, label }) => {
      let currUsers = 0, prevUsers = 0;
      for (const f of facts) {
        const times = f.featureTimes[key] ?? [];
        if (times.some(t => t >= currFrom)) currUsers++;
        if (times.some(t => t >= prevFrom && t < currFrom)) prevUsers++;
      }
      const currPct = pctOf(currUsers, totalUsers);
      const prevPct = pctOf(prevUsers, totalUsers);
      return { key, label, currUsers, prevUsers, currPct, prevPct, deltaPct: currPct - prevPct };
    }).sort((a, b) => b.currPct - a.currPct);

    /* ── Experimentos (comparação por versão) ──
       A versão do app não é persistida no perfil: estrutura pronta,
       resultado declarado como não instrumentado (nunca inventado). */
    const experiments: CrmExperiments = {
      instrumented: false,
      note: 'A versão do app ainda não é persistida por conta. Assim que o campo existir, cada versão vira um braço comparável (retenção D7, finalização de turno e corridas por usuário).',
      arms: [],
    };

    /* ── Product Health ── */
    const retentionD7 = (() => {
      let eligible = 0, retained = 0;
      for (const f of facts) {
        if (!Number.isFinite(f.signup)) continue;
        const d = dayIndex(f.signup);
        if (today - d < 7) continue;
        eligible++;
        if (f.activityDays.has(d + 7)) retained++;
      }
      return eligible > 0 ? pctOf(retained, eligible) : null;
    })();
    const shiftsStartedAll = facts.reduce((s, f) => s + f.shiftsStarted, 0);
    const shiftsEndedAll = facts.reduce((s, f) => s + f.shiftsEnded, 0);
    const completion = shiftsStartedAll > 0 ? pctOf(shiftsEndedAll, shiftsStartedAll) : null;
    const ridesAll = facts.reduce((s, f) => s + f.ridesTotal, 0);
    const gpsShare = ridesAll > 0 ? pctOf(facts.reduce((s, f) => s + f.ridesGps, 0), ridesAll) : null;
    const sessionShare = totalUsers > 0 ? pctOf(activeCurr, totalUsers) : null;
    const abandonShare = totalUsers > 0 ? 100 - pctOf(atRiskUsers, totalUsers) : null;

    const components: CrmHealthComponent[] = [
      { key: 'retention', label: 'Retenção D7', value: retentionD7, weight: 30, instrumented: retentionD7 !== null },
      { key: 'crashes', label: 'Estabilidade / crashes', value: null, weight: 0, instrumented: false },
      { key: 'gps', label: 'Captura por GPS', value: gpsShare, weight: 15, instrumented: gpsShare !== null },
      { key: 'completion', label: 'Finalização de turno', value: completion, weight: 25, instrumented: completion !== null },
      { key: 'sessions', label: 'Sessões ativas (7d)', value: sessionShare, weight: 15, instrumented: sessionShare !== null },
      { key: 'abandon', label: 'Ausência de abandono', value: abandonShare, weight: 15, instrumented: abandonShare !== null },
    ];
    const weighted = components.filter(c => c.instrumented && c.value !== null && c.weight > 0);
    const weightSum = weighted.reduce((s, c) => s + c.weight, 0);
    const healthScore = weightSum > 0
      ? round(weighted.reduce((s, c) => s + (c.value as number) * c.weight, 0) / weightSum)
      : 0;
    // Delta = variação de sessões ativas semana a semana (único componente com janela comparável).
    const prevSessionShare = totalUsers > 0 ? pctOf(activePrev, totalUsers) : 0;
    const healthDelta = round(((sessionShare ?? 0) - prevSessionShare) * (15 / (weightSum || 100)) * 1, 1);

    /* ── Customer Journey ── */
    const returned = facts.filter(f => f.activityDays.size >= 2).length;
    const recurring = facts.filter(f => [...f.activityDays].filter(d => today - d <= 29 && today - d >= 0).length >= 4).length;
    const rawJourney: { key: string; label: string; users: number; instrumented: boolean }[] = [
      { key: 'install', label: 'Instalou', users: 0, instrumented: false },
      { key: 'account', label: 'Criou conta', users: totalUsers, instrumented: true },
      { key: 'vehicle', label: 'Criou veículo', users: facts.filter(f => f.hasVehicle).length, instrumented: true },
      { key: 'shift', label: 'Iniciou turno', users: facts.filter(f => f.shiftsStarted > 0).length, instrumented: true },
      { key: 'ride', label: 'Registrou corrida', users: facts.filter(f => f.ridesTotal > 0).length, instrumented: true },
      { key: 'goal', label: 'Criou meta', users: facts.filter(f => f.hasGoal).length, instrumented: true },
      { key: 'return', label: 'Voltou', users: returned, instrumented: true },
      { key: 'recurring', label: 'Virou usuário recorrente', users: recurring, instrumented: true },
    ];
    const journeyTop = totalUsers;
    const journey: CrmJourneyStage[] = rawJourney.map((s, i) => {
      const prev = rawJourney.slice(0, i).reverse().find(x => x.instrumented);
      const prevUsers = prev?.users ?? s.users;
      return {
        ...s,
        pctOfTop: s.instrumented ? pctOf(s.users, journeyTop) : 0,
        dropFromPrevPct: s.instrumented && prevUsers > 0 ? ((prevUsers - s.users) / prevUsers) * 100 : 0,
      };
    });

    /* ── Recomendações automáticas ── */
    const recommendations: CrmRecommendation[] = [];
    const noFinancial = segUsers('sem_financeiro');
    if (totalUsers > 0 && noFinancial > 0 && segPct('sem_financeiro') >= 40) {
      recommendations.push({
        id: 'financial_onboarding',
        title: 'Ensinar o Financeiro no primeiro turno',
        evidence: `${noFinancial} usuários (${segPct('sem_financeiro').toFixed(0)}%) nunca lançaram nada no Financeiro.`,
        action: 'Mostrar onboarding do Financeiro ao encerrar o primeiro turno, com lançamento de 1 toque.',
        priority: segPct('sem_financeiro') >= 70 ? 'Alta' : 'Média',
      });
    }
    const newUsers = facts.filter(isNew);
    const newWithoutGoal = newUsers.filter(f => !f.hasGoal).length;
    if (newUsers.length >= 3 && pctOf(newWithoutGoal, newUsers.length) >= 50) {
      recommendations.push({
        id: 'goals_placement',
        title: 'Aproximar a criação de metas',
        evidence: `${pctOf(newWithoutGoal, newUsers.length).toFixed(0)}% dos novos usuários não criam metas.`,
        action: 'Mover o botão de meta para o Dashboard (bloco Meta) e sugerir um valor padrão pela média do motorista.',
        priority: 'Alta',
      });
    }
    if (gpsShare !== null && gpsShare < 40) {
      recommendations.push({
        id: 'gps_activation',
        title: 'Ativar o GPS automático',
        evidence: `${gpsShare.toFixed(0)}% das corridas vêm do GPS; ${segUsers('so_manual')} motoristas usam só manual.`,
        action: 'Reforçar permissão em background no onboarding e confirmar corridas detectadas pela notificação.',
        priority: gpsShare < 20 ? 'Alta' : 'Média',
      });
    }
    if (completion !== null && completion < 80) {
      recommendations.push({
        id: 'shift_close',
        title: 'Reduzir turnos abertos',
        evidence: `${(100 - completion).toFixed(0)}% dos turnos iniciados nunca são finalizados.`,
        action: 'Encerramento automático por inatividade + ação "Finalizar turno" na notificação persistente.',
        priority: 'Alta',
      });
    }
    if (atRiskUsers > 0) {
      recommendations.push({
        id: 'churn_winback',
        title: 'Reativar motoristas em risco',
        evidence: `${atRiskUsers} usuários com risco de abandono ≥ 60%.`,
        action: 'Notificação de retorno com o resumo do último turno e a meta da semana.',
        priority: pctOf(atRiskUsers, totalUsers) >= 30 ? 'Alta' : 'Média',
      });
    }
    const quickTrend = adoption.find(a => a.key === 'quick_actions');
    if (quickTrend && quickTrend.deltaPct < 0 && quickTrend.prevUsers > 0) {
      recommendations.push({
        id: 'quick_actions_drop',
        title: 'Quick Actions perdendo uso',
        evidence: `Adoção caiu de ${quickTrend.prevPct.toFixed(0)}% para ${quickTrend.currPct.toFixed(0)}% em uma semana.`,
        action: 'Verificar permanência da notificação persistente no Android e reduzir o número de ações visíveis.',
        priority: 'Média',
      });
    }
    if (totalUsers === 0) {
      recommendations.push({
        id: 'no_data',
        title: 'Base insuficiente',
        evidence: 'Nenhum usuário na base ainda.',
        action: 'Aguardar volume mínimo antes de tomar decisões de produto por estes indicadores.',
        priority: 'Baixa',
      });
    }

    return {
      scores,
      avgScore,
      churnRisks,
      atRiskUsers,
      segments,
      recommendations,
      adoption,
      experiments,
      productHealth: { score: healthScore, delta: healthDelta, components },
      journey,
    };
  },
};
