/**
 * MetricsService — ÚNICO responsável por regra de negócio financeira/analítica.
 *
 * Absorve toda a lógica de cálculo que antes estava dispersa em componentes,
 * `types.computeStats`, `expenseAnalytics`, `historyAggregation` e `shifts.computeTotals`.
 *
 * Nenhum componente React pode calcular lucro, custo/km, streaks, agregações
 * ou insights: tudo passa por aqui.
 *
 * Consome APENAS:
 *   - rideRepository (leitura de DailyEntry, RideEntry, Shift.rides)
 *   - financialService (income/bonus/expense)
 *   - settingsService (profitMargin, currency, alertThresholds)
 */

import { rideRepository } from '../repositories/rideRepository';
import { financialService } from './financialService';
import { settingsService } from './settingsService';
import type { DailyEntry, PerformanceStats } from '../types';
import type { RideModel } from '../domain/models';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers puros
// ═══════════════════════════════════════════════════════════════════════════
const DAY_MS = 86400000;
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}
function dayKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return startOfDay(d).toISOString().slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipos públicos
// ═══════════════════════════════════════════════════════════════════════════
export interface DayMetrics {
  date: string;
  grossEarnings: number;
  bonus: number;
  income: number;
  expense: number;
  totalCost: number;
  netProfit: number;
  km: number;
  hoursWorked: number;
  profitPerHour: number;
  profitPerKm: number;
  costPerKm: number;
  minIdealKm: number;
  rawEntry: DailyEntry | null;
}

export interface RangeMetrics {
  from: string;
  to: string;
  grossEarnings: number;
  bonus: number;
  income: number;
  expense: number;
  totalCost: number;
  netProfit: number;
  km: number;
  hoursWorked: number;
}

export interface AdjustedDailyEntry extends DailyEntry {
  expensesExtra: number;
  expenseOnly?: boolean;
}

export interface DashboardSnapshot {
  today: DayMetrics;
  stats: PerformanceStats;
  entriesCount: number;
  expensesByCategory: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cálculo canônico de estatísticas semanais
// ═══════════════════════════════════════════════════════════════════════════
function computeStatsInternal(entries: DailyEntry[], dailyGoal: number): PerformanceStats {
  const now = new Date();
  const today = startOfDay(now);
  const todayEntry = entries.find(e => isSameDay(new Date(e.date), now)) ?? null;

  const last7 = entries.filter(e => daysBetween(new Date(e.date), today) < 7);
  const prev7 = entries.filter(e => {
    const d = daysBetween(new Date(e.date), today);
    return d >= 7 && d < 14;
  });

  const sum = (arr: DailyEntry[], k: keyof DailyEntry) =>
    arr.reduce((s, e) => s + (e[k] as number), 0);

  const weekTotal = sum(last7, 'totalEarnings');
  const weekProfit = sum(last7, 'profit');
  const weekAvgProfit = last7.length > 0 ? weekProfit / last7.length : 0;
  const lastWeekProfit = sum(prev7, 'profit');
  const weekChangePct = prev7.length > 0 && lastWeekProfit !== 0
    ? ((weekProfit - lastWeekProfit) / Math.abs(lastWeekProfit)) * 100
    : null;

  const weekCost = sum(last7, 'totalCost');
  const lastWeekCost = sum(prev7, 'totalCost');
  const costChangePct = lastWeekCost > 0 ? ((weekCost - lastWeekCost) / lastWeekCost) * 100 : null;

  const byWeekday: Record<number, { sum: number; count: number }> = {};
  entries.forEach(e => {
    const w = new Date(e.date).getDay();
    byWeekday[w] = byWeekday[w] || { sum: 0, count: 0 };
    byWeekday[w].sum += e.profit;
    byWeekday[w].count += 1;
  });
  let bestDayOfWeek: { day: string; avg: number } | null = null;
  Object.entries(byWeekday).forEach(([w, v]) => {
    const avg = v.sum / v.count;
    if (!bestDayOfWeek || avg > bestDayOfWeek.avg) {
      bestDayOfWeek = { day: WEEKDAYS[Number(w)], avg };
    }
  });

  const bestDay = entries.reduce<DailyEntry | null>(
    (best, e) => (!best || e.profit > best.profit ? e : best), null,
  );
  const recordProfit = bestDay?.profit ?? 0;

  let streak = 0;
  if (dailyGoal > 0) {
    const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let cursor = today;
    const hasToday = sorted.some(e => isSameDay(new Date(e.date), cursor));
    if (!hasToday) cursor = new Date(today.getTime() - DAY_MS);
    for (;;) {
      const entry = sorted.find(e => isSameDay(new Date(e.date), cursor));
      if (entry && entry.profit >= dailyGoal) {
        streak += 1;
        cursor = new Date(cursor.getTime() - DAY_MS);
      } else break;
    }
  }

  return {
    todayEntry, weekTotal, weekProfit, weekAvgProfit,
    lastWeekProfit, weekChangePct, costChangePct,
    bestDayOfWeek, bestDay, recordProfit, streak,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Timeline / merge com FinancialEntry (read-side, sem alterar storage)
// ═══════════════════════════════════════════════════════════════════════════
function sumExpensesByDay(): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of financialService.list({ type: 'expense' })) {
    map.set(dayKey(e.date), (map.get(dayKey(e.date)) ?? 0) + e.value);
  }
  return map;
}

/**
 * Devolve DailyEntry ajustado com despesas do dia somadas no custo/lucro.
 * Para dias que têm SÓ gasto e nenhum turno, cria entry sintético.
 */
function mergeExpensesIntoEntries(entries: DailyEntry[]): AdjustedDailyEntry[] {
  const byDay = sumExpensesByDay();
  const used = new Set<string>();
  const expenses = financialService.list({ type: 'expense' });
  const dayItems = new Map<string, { total: number; sampleDate: string }>();
  for (const e of expenses) {
    const k = dayKey(e.date);
    const cur = dayItems.get(k) ?? { total: 0, sampleDate: e.date };
    cur.total += e.value;
    dayItems.set(k, cur);
  }

  const adjusted: AdjustedDailyEntry[] = entries.map(e => {
    const k = dayKey(e.date);
    const extra = byDay.get(k) ?? 0;
    if (extra > 0) used.add(k);
    const totalCost = e.totalCost + extra;
    const profit = e.totalEarnings - totalCost;
    return {
      ...e,
      expensesExtra: extra,
      totalCost,
      profit,
      profitPerHour: e.hoursWorked > 0 ? profit / e.hoursWorked : 0,
      profitPerKm: e.kmDriven > 0 ? profit / e.kmDriven : 0,
    };
  });

  entries.forEach(e => used.add(dayKey(e.date)));

  for (const [k, v] of dayItems.entries()) {
    if (used.has(k)) continue;
    adjusted.push({
      id: `expense-only-${k}`,
      date: v.sampleDate,
      hoursWorked: 0, kmDriven: 0, totalEarnings: 0,
      fuelPrice: 0, vehicleConsumption: 0,
      installment: 0, maintenance: 0, insurance: 0, otherCosts: 0,
      litersConsumed: 0, fuelCost: 0,
      monthlyFixedCosts: 0, dailyFixedCost: 0,
      totalCost: v.total,
      profit: -v.total,
      profitPerHour: 0, profitPerKm: 0,
      expensesExtra: v.total,
      expenseOnly: true,
    });
  }

  adjusted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return adjusted;
}

// ═══════════════════════════════════════════════════════════════════════════
// Análise de corrida individual (RideAnalyzer, Dashboard focus mode)
// ═══════════════════════════════════════════════════════════════════════════
export interface RideAnalysis {
  costPerKm: number;
  minIdealKm: number;
  ridePerKm: number;
  profit: number;
  verdict: 'good' | 'ok' | 'bad';
}

// ═══════════════════════════════════════════════════════════════════════════
// Insights de despesa (antes: expenseAnalytics.ts)
// ═══════════════════════════════════════════════════════════════════════════
export interface ExpenseInsights {
  todayList: Array<{ id: string; date: string; value: number; category: string; description?: string }>;
  todayTotal: number;
  weekTotal: number;
  prevWeekTotal: number;
  weekVariation: number;
  weekVariationPct: number | null;
  dailyAvg: number;
  weekForecast: number;
  byCategoryToday: Record<string, { total: number; count: number }>;
  byCategoryWindow: Record<string, { total: number; count: number }>;
  windowDays: number;
  dominantCategory: string | null;
  profile: 'Gasto impulsivo' | 'Custo operacional alto' | 'Controle saudável' | null;
  weekSeries: { day: string; date: string; expenses: number; savings: number }[];
  bestDayWeek: { day: string; total: number } | null;
  worstDayWeek: { day: string; total: number } | null;
  controlStreak: number;
  bestSavingsDay: { date: string; saved: number } | null;
  consciousnessMode: boolean;
  earningsToday: number;
  profitImpact: number;
  todayEntry: DailyEntry | null;
  outOfPattern: Array<{ id: string; value: number; description?: string }>;
  recurringGroups: { category: string; label: string; days: number; avg: number }[];
}

function computeExpenseInsights(savingsGoalDaily: number, windowDays = 7): ExpenseInsights {
  const entries = rideRepository.listEntries();
  const all = financialService.list({ type: 'expense' }).map(e => ({
    id: e.id, date: e.date, value: e.value,
    category: e.category, description: e.notes,
  }));
  const now = new Date();
  const today0 = startOfDay(now).getTime();
  const W = Math.max(1, windowDays);
  const weekStart = today0 - (W - 1) * DAY_MS;
  const prevWeekStart = today0 - (2 * W - 1) * DAY_MS;
  const prevWeekEnd = today0 - (W - 1) * DAY_MS;

  const inRange = (fromMs: number, toMs: number) =>
    all.filter(e => { const t = new Date(e.date).getTime(); return t >= fromMs && t < toMs; });

  const todayList = all.filter(e => isSameDay(new Date(e.date), now));
  const sum = (arr: typeof all) => arr.reduce((s, e) => s + e.value, 0);
  const todayTotal = sum(todayList);

  const weekList = inRange(weekStart, today0 + DAY_MS);
  const weekTotal = sum(weekList);
  const prevWeekList = inRange(prevWeekStart, prevWeekEnd);
  const prevWeekTotal = sum(prevWeekList);

  const weekVariation = weekTotal - prevWeekTotal;
  const weekVariationPct = prevWeekTotal > 0 ? (weekVariation / prevWeekTotal) * 100 : null;

  const daySums: Record<string, number> = {};
  for (const e of weekList) {
    const k = dayKey(e.date);
    daySums[k] = (daySums[k] || 0) + e.value;
  }
  const dayValues = Object.values(daySums);
  const dailyAvg = dayValues.length > 0 ? dayValues.reduce((s, v) => s + v, 0) / dayValues.length : 0;
  const weekForecast = dailyAvg * 7;

  const groupByCat = (list: typeof all) => {
    const out: Record<string, { total: number; count: number }> = {};
    for (const e of list) {
      out[e.category] = out[e.category] ?? { total: 0, count: 0 };
      out[e.category].total += e.value;
      out[e.category].count += 1;
    }
    return out;
  };
  const byCategoryToday = groupByCat(todayList);
  const byCategoryWindow = groupByCat(weekList);

  let dominantCategory: string | null = null;
  let domTotal = 0;
  for (const [c, v] of Object.entries(byCategoryToday)) {
    if (v.total > domTotal) { domTotal = v.total; dominantCategory = c; }
  }
  let profile: ExpenseInsights['profile'] = null;
  if (todayTotal > 0 && dominantCategory) {
    const share = domTotal / todayTotal;
    if (share >= 0.5) {
      if (dominantCategory === 'Alimentação') profile = 'Gasto impulsivo';
      else if (dominantCategory === 'Manutenção') profile = 'Custo operacional alto';
      else profile = 'Controle saudável';
    } else profile = 'Controle saudável';
  }

  const outOfPattern = dailyAvg > 0
    ? todayList.filter(e => e.value > dailyAvg * 0.5 && e.value > 0)
    : [];

  // Recorrência simples (cluster por categoria + Jaccard descrição)
  function norm(s?: string) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  const STOP = new Set(['de','da','do','na','no','a','o','e','em','pra','para','um','uma']);
  function toks(s: string) { return new Set(s.split(' ').filter(t => t.length > 1 && !STOP.has(t))); }
  function jaccard(a: Set<string>, b: Set<string>) {
    if (a.size === 0 && b.size === 0) return 1;
    if (a.size === 0 || b.size === 0) return 0.6;
    let inter = 0; for (const x of a) if (b.has(x)) inter++;
    const uni = a.size + b.size - inter; return uni === 0 ? 0 : inter / uni;
  }
  function median(arr: number[]) {
    const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m-1]+s[m])/2;
  }
  type Cluster = { category: string; label: string; tokens: Set<string>; days: Set<string>; values: number[] };
  const clustersByCat = new Map<string, Cluster[]>();
  for (const e of weekList) {
    const tk = toks(norm(e.description));
    const list = clustersByCat.get(e.category) ?? [];
    let target = list.find(c => jaccard(c.tokens, tk) >= 0.5);
    if (!target) {
      target = { category: e.category, label: e.description?.trim() || e.category, tokens: tk, days: new Set(), values: [] };
      list.push(target); clustersByCat.set(e.category, list);
    } else {
      for (const t of tk) target.tokens.add(t);
      const inc = e.description?.trim() || ''; if (inc.length > target.label.length) target.label = inc;
    }
    target.days.add(dayKey(e.date));
    target.values.push(e.value);
  }
  const recurringGroups: ExpenseInsights['recurringGroups'] = [];
  const minDays = Math.max(3, Math.ceil(W * 0.3));
  for (const list of clustersByCat.values()) {
    for (const c of list) {
      if (c.days.size < minDays) continue;
      const med = median(c.values); if (med <= 0) continue;
      const mad = median(c.values.map(v => Math.abs(v - med)));
      if (med > 0 && mad / med > 0.75) continue;
      recurringGroups.push({
        category: c.category, label: c.label,
        days: c.days.size, avg: c.values.reduce((s, v) => s + v, 0) / c.values.length,
      });
    }
  }
  recurringGroups.sort((a, b) => b.days - a.days);

  const totalsByDay: { total: number; weekday: number }[] = [];
  for (let i = 0; i < W; i++) {
    const dStart = today0 - i * DAY_MS;
    const dEnd = dStart + DAY_MS;
    totalsByDay.push({ total: sum(inRange(dStart, dEnd)), weekday: new Date(dStart).getDay() });
  }
  const daysWithAny = totalsByDay.filter(d => d.total > 0);
  const bestDayWeek = daysWithAny.length > 0
    ? (() => { const m = daysWithAny.reduce((b,d)=> d.total<b.total?d:b); return { day: WEEKDAYS[m.weekday], total: m.total }; })()
    : null;
  const worstDayWeek = daysWithAny.length > 0
    ? (() => { const m = daysWithAny.reduce((b,d)=> d.total>b.total?d:b); return { day: WEEKDAYS[m.weekday], total: m.total }; })()
    : null;

  const weekSeries: ExpenseInsights['weekSeries'] = [];
  for (let i = W - 1; i >= 0; i--) {
    const dStart = today0 - i * DAY_MS;
    const dEnd = dStart + DAY_MS;
    const total = sum(inRange(dStart, dEnd));
    const d = new Date(dStart);
    const label = W <= 14 ? WEEKDAYS[d.getDay()].slice(0,3)
      : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    weekSeries.push({
      day: label, date: d.toISOString(),
      expenses: Number(total.toFixed(2)),
      savings: savingsGoalDaily > 0 ? Number((savingsGoalDaily - total).toFixed(2)) : 0,
    });
  }

  let controlStreak = 0;
  if (savingsGoalDaily > 0) {
    for (let i = 0; i < 60; i++) {
      const dStart = today0 - i * DAY_MS;
      const total = sum(inRange(dStart, dStart + DAY_MS));
      if (i === 0 && total === 0) continue;
      if (total <= savingsGoalDaily) controlStreak++;
      else break;
    }
  }

  let bestSavingsDay: ExpenseInsights['bestSavingsDay'] = null;
  if (savingsGoalDaily > 0) {
    for (let i = 0; i < 30; i++) {
      const dStart = today0 - i * DAY_MS;
      const total = sum(inRange(dStart, dStart + DAY_MS));
      const saved = savingsGoalDaily - total;
      if (saved > 0 && (!bestSavingsDay || saved > bestSavingsDay.saved)) {
        bestSavingsDay = { date: new Date(dStart).toISOString(), saved };
      }
    }
  }

  const todayEntry = entries.find(e => isSameDay(new Date(e.date), now)) ?? null;
  const earningsToday = todayEntry?.totalEarnings ?? 0;
  const profitImpact = todayTotal;

  let highSpendDays = 0;
  if (savingsGoalDaily > 0) {
    for (let i = 0; i < 7; i++) {
      const dStart = today0 - i * DAY_MS;
      const total = sum(inRange(dStart, dStart + DAY_MS));
      if (total > savingsGoalDaily) highSpendDays++;
    }
  }
  const weekEarnings = entries
    .filter(e => new Date(e.date).getTime() >= weekStart)
    .reduce((s, e) => s + e.totalEarnings, 0);
  const consciousnessMode = highSpendDays >= 3 || (weekEarnings > 0 && weekTotal > weekEarnings * 0.3);

  return {
    todayList, todayTotal, weekTotal, prevWeekTotal, weekVariation, weekVariationPct,
    dailyAvg, weekForecast, byCategoryToday, byCategoryWindow, windowDays: W,
    dominantCategory, profile, outOfPattern: outOfPattern.map(e => ({ id: e.id, value: e.value, description: e.description })),
    recurringGroups, weekSeries, bestDayWeek, worstDayWeek,
    controlStreak, bestSavingsDay, consciousnessMode, todayEntry, earningsToday, profitImpact,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// API pública
// ═══════════════════════════════════════════════════════════════════════════
export const metricsService = {
  dayMetrics(date: Date = new Date()): DayMetrics {
    const entries = rideRepository.listEntries();
    const rawEntry = entries.find(e => isSameDay(new Date(e.date), date)) ?? null;
    const sums = financialService.sumByDay(date);
    const settings = settingsService.get();

    const grossEarnings = rawEntry?.totalEarnings ?? 0;
    const km = rawEntry?.kmDriven ?? 0;
    const hoursWorked = rawEntry?.hoursWorked ?? 0;
    const baseCost = rawEntry?.totalCost ?? 0;
    const totalCost = baseCost + sums.expense;
    const netProfit = grossEarnings + sums.bonus + sums.income - totalCost;
    const profitPerHour = hoursWorked > 0 ? netProfit / hoursWorked : 0;
    const profitPerKm = km > 0 ? netProfit / km : 0;
    const costPerKm = km > 0 ? totalCost / km : 0;
    const minIdealKm = costPerKm * settings.profitMargin;

    return {
      date: date.toISOString(),
      grossEarnings, bonus: sums.bonus, income: sums.income, expense: sums.expense,
      totalCost, netProfit, km, hoursWorked,
      profitPerHour, profitPerKm, costPerKm, minIdealKm,
      rawEntry,
    };
  },

  rangeMetrics(from: Date, to: Date): RangeMetrics {
    const f = startOfDay(from);
    const t = endOfDay(to);
    const entries = rideRepository.listEntries().filter(e => {
      const d = new Date(e.date).getTime();
      return d >= f.getTime() && d <= t.getTime();
    });
    const fin = financialService.sumRange(f, t);
    const gross = entries.reduce((s, e) => s + e.totalEarnings, 0);
    const km = entries.reduce((s, e) => s + e.kmDriven, 0);
    const hours = entries.reduce((s, e) => s + e.hoursWorked, 0);
    const cost = entries.reduce((s, e) => s + e.totalCost, 0) + fin.expense;
    const net = gross + fin.bonus + fin.income - cost;
    return {
      from: f.toISOString(), to: t.toISOString(),
      grossEarnings: gross, bonus: fin.bonus, income: fin.income, expense: fin.expense,
      totalCost: cost, netProfit: net, km, hoursWorked: hours,
    };
  },

  dashboardSnapshot(goalDaily: number): DashboardSnapshot {
    const entries = rideRepository.listEntries();
    const stats = computeStatsInternal(entries, goalDaily);
    const today = this.dayMetrics(new Date());
    const dayStart = startOfDay(new Date());
    const dayEnd = endOfDay(new Date());
    const expensesRaw = financialService.groupByCategory({
      type: 'expense', from: dayStart, to: dayEnd,
    });
    const expensesByCategory: Record<string, number> = {};
    for (const [k, v] of Object.entries(expensesRaw)) expensesByCategory[k] = v;
    return { today, stats, entriesCount: entries.length, expensesByCategory };
  },

  /**
   * Histórico ajustado (DailyEntry + despesas do dia). Substitui
   * `historyAggregation.mergeExpensesIntoEntries` — componentes só recebem
   * o resultado, sem tocar em storage.
   */
  historyEntries(): AdjustedDailyEntry[] {
    const entries = rideRepository.listEntries();
    return mergeExpensesIntoEntries(entries);
  },

  /**
   * PerformanceStats calculado sobre uma lista arbitrária de entries
   * (útil quando o histórico está filtrado por veículo/tipo).
   */
  statsFor(entries: DailyEntry[], dailyGoal: number): PerformanceStats {
    return computeStatsInternal(entries, dailyGoal);
  },

  expenseInsights(savingsGoalDaily: number, windowDays = 7): ExpenseInsights {
    return computeExpenseInsights(savingsGoalDaily, windowDays);
  },

  /**
   * Análise pontual de uma corrida — usada por RideAnalyzer/FAB.
   */
  analyzeRide(input: { value: number; km: number }): RideAnalysis {
    const settings = settingsService.get();
    const today = this.dayMetrics(new Date());
    const rawEntry = today.rawEntry;
    const costPerKm = rawEntry && rawEntry.kmDriven > 0
      ? rawEntry.totalCost / rawEntry.kmDriven
      : 0;
    const minIdealKm = costPerKm * settings.profitMargin;
    const ridePerKm = input.km > 0 ? input.value / input.km : 0;
    const profit = input.value - costPerKm * input.km;
    let verdict: RideAnalysis['verdict'] = 'ok';
    if (minIdealKm > 0) {
      if (ridePerKm >= minIdealKm * 1.2) verdict = 'good';
      else if (ridePerKm < minIdealKm) verdict = 'bad';
    } else if (profit > 0) verdict = 'good';
    else if (profit < 0) verdict = 'bad';
    return { costPerKm, minIdealKm, ridePerKm, profit, verdict };
  },

  /**
   * Lista os RideModel mais recentes de captura individual (manual/quick).
   * Fase 2.2: substitui o antigo retorno de RideEntry — HistoryView e afins
   * consomem RideModel puro.
   */
  recentIndividualRides(limit = 20): RideModel[] {
    return rideRepository.list()
      .filter(r => r.captureMode === 'manual' || r.captureMode === 'quick')
      .slice(0, limit);
  },

  /**
   * Base de custo/km da última DailyEntry disponível — usada pelo
   * RideAnalyzer para exibir "mínimo ideal". Retorna null quando não há
   * base ainda.
   */
  rideCostBase(): { costPerKm: number; minIdealKm: number } | null {
    const entries = rideRepository.listEntries();
    const latest = entries.length > 0 ? entries[0] : null;
    if (!latest || latest.kmDriven <= 0) return null;
    const costPerKm = latest.totalCost / latest.kmDriven;
    const minIdealKm = costPerKm * settingsService.get().profitMargin;
    return { costPerKm, minIdealKm };
  },

  /** Total de entries (usado por engagement/onboarding para gating). */
  entriesCount(): number { return rideRepository.listEntries().length; },
};

export type MetricsService = typeof metricsService;
