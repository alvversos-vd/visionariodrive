import { Expense, ExpenseCategory, EXPENSE_CATEGORIES, getExpenses, groupByCategory, sumExpenses } from './expenses';
import { getEntries } from './storage';
import { DailyEntry } from './types';

const DAY = 86400000;
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function expensesInRange(list: Expense[], fromMs: number, toMs: number): Expense[] {
  return list.filter(e => {
    const t = new Date(e.date).getTime();
    return t >= fromMs && t < toMs;
  });
}

export interface ExpenseAnalytics {
  todayList: Expense[];
  todayTotal: number;
  weekTotal: number;
  prevWeekTotal: number;
  weekVariation: number;
  weekVariationPct: number | null;
  dailyAvg: number; // last 7 days average
  weekForecast: number;
  byCategoryToday: Record<ExpenseCategory, { total: number; count: number }>;
  byCategoryWindow: Record<ExpenseCategory, { total: number; count: number }>;
  windowDays: number;
  dominantCategory: ExpenseCategory | null;
  profile: 'Gasto impulsivo' | 'Custo operacional alto' | 'Controle saudável' | null;
  outOfPattern: Expense[];
  recurringCategories: ExpenseCategory[];
  recurringGroups: { category: ExpenseCategory; label: string; days: number; avg: number }[];
  weekSeries: { day: string; date: string; expenses: number; savings: number }[];
  bestDayWeek: { day: string; total: number } | null;
  worstDayWeek: { day: string; total: number } | null;
  controlStreak: number;
  bestSavingsDay: { date: string; saved: number } | null;
  consciousnessMode: boolean;
  todayEntry: DailyEntry | null;
  earningsToday: number;
  profitImpact: number;
}

export function computeExpenseAnalytics(
  savingsGoalDaily: number,
  windowDays: number = 7,
): ExpenseAnalytics {
  const all = getExpenses();
  const entries = getEntries();
  const now = new Date();
  const today0 = startOfDay(now).getTime();
  const W = Math.max(1, windowDays);
  const weekStart = today0 - (W - 1) * DAY; // last W days inc today
  const prevWeekStart = today0 - (2 * W - 1) * DAY;
  const prevWeekEnd = today0 - (W - 1) * DAY;

  const todayList = all.filter(e => isSameDay(new Date(e.date), now));
  const todayTotal = sumExpenses(todayList);

  const weekList = expensesInRange(all, weekStart, today0 + DAY);
  const weekTotal = sumExpenses(weekList);
  const prevWeekList = expensesInRange(all, prevWeekStart, prevWeekEnd);
  const prevWeekTotal = sumExpenses(prevWeekList);

  const weekVariation = weekTotal - prevWeekTotal;
  const weekVariationPct = prevWeekTotal > 0 ? (weekVariation / prevWeekTotal) * 100 : null;

  // Daily average over the window (only counting days with expenses)
  const daySums: Record<string, number> = {};
  for (const e of weekList) {
    const k = startOfDay(new Date(e.date)).toISOString();
    daySums[k] = (daySums[k] || 0) + e.value;
  }
  const dayValues = Object.values(daySums);
  const dailyAvg = dayValues.length > 0 ? dayValues.reduce((s, v) => s + v, 0) / dayValues.length : 0;
  const weekForecast = dailyAvg * 7;

  const byCategoryToday = groupByCategory(todayList);
  const byCategoryWindow = groupByCategory(weekList);

  // Dominant category (today)
  let dominantCategory: ExpenseCategory | null = null;
  let domTotal = 0;
  for (const c of EXPENSE_CATEGORIES) {
    if (byCategoryToday[c].total > domTotal) {
      domTotal = byCategoryToday[c].total;
      dominantCategory = c;
    }
  }

  // Profile
  let profile: ExpenseAnalytics['profile'] = null;
  if (todayTotal > 0 && dominantCategory) {
    const share = domTotal / todayTotal;
    if (share >= 0.5) {
      if (dominantCategory === 'Alimentação') profile = 'Gasto impulsivo';
      else if (dominantCategory === 'Manutenção') profile = 'Custo operacional alto';
      else profile = 'Controle saudável';
    } else {
      profile = 'Controle saudável';
    }
  }

  // Out of pattern individual expenses (today)
  const outOfPattern = dailyAvg > 0
    ? todayList.filter(e => e.value > dailyAvg * 0.5 && e.value > 0)
    : [];

  // Recurring detection v2
  // - Normalize description and split into tokens
  // - Cluster expenses (same category) when token-set Jaccard ≥ 0.5 OR one is empty
  // - Require: occurrences on ≥3 distinct days AND coverage ≥ 30% of days-in-window
  // - Tolerate value variability via median-based MAD; only flag if values are reasonably consistent
  function normalizeDesc(s?: string) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  const STOP = new Set(['de', 'da', 'do', 'na', 'no', 'a', 'o', 'e', 'em', 'pra', 'para', 'um', 'uma']);
  function tokens(s: string): Set<string> {
    return new Set(s.split(' ').filter(t => t.length > 1 && !STOP.has(t)));
  }
  function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    if (a.size === 0 || b.size === 0) return 0.6; // empty desc considered loosely similar
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : inter / union;
  }
  function median(arr: number[]) {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  type Cluster = {
    category: ExpenseCategory;
    label: string;
    tokens: Set<string>;
    days: Set<string>;
    values: number[];
  };
  const clustersByCat = new Map<ExpenseCategory, Cluster[]>();
  for (const e of weekList) {
    const desc = normalizeDesc(e.description);
    const tk = tokens(desc);
    const list = clustersByCat.get(e.category) ?? [];
    let target = list.find(c => jaccard(c.tokens, tk) >= 0.5);
    if (!target) {
      target = {
        category: e.category,
        label: e.description?.trim() || e.category,
        tokens: tk,
        days: new Set<string>(),
        values: [],
      };
      list.push(target);
      clustersByCat.set(e.category, list);
    } else {
      // merge tokens; keep the most descriptive label (longer)
      for (const t of tk) target.tokens.add(t);
      const incoming = e.description?.trim() || '';
      if (incoming.length > target.label.length) target.label = incoming;
    }
    target.days.add(startOfDay(new Date(e.date)).toISOString());
    target.values.push(e.value);
  }

  const recurringGroups: { category: ExpenseCategory; label: string; days: number; avg: number }[] = [];
  const minDays = Math.max(3, Math.ceil(W * 0.3));
  for (const list of clustersByCat.values()) {
    for (const c of list) {
      if (c.days.size < minDays) continue;
      const med = median(c.values);
      if (med <= 0) continue;
      // MAD relative to median; allow up to 75% deviation
      const mad = median(c.values.map(v => Math.abs(v - med)));
      if (med > 0 && mad / med > 0.75) continue;
      recurringGroups.push({
        category: c.category,
        label: c.label,
        days: c.days.size,
        avg: c.values.reduce((s, v) => s + v, 0) / c.values.length,
      });
    }
  }
  recurringGroups.sort((a, b) => b.days - a.days);
  const recurringCategories: ExpenseCategory[] = Array.from(
    new Set(recurringGroups.map(r => r.category)),
  );

  // Best / worst day in the window (by weekday)
  const totalsByDay: { dateKey: string; total: number; weekday: number }[] = [];
  for (let i = 0; i < W; i++) {
    const dStart = today0 - i * DAY;
    const dEnd = dStart + DAY;
    const total = sumExpenses(expensesInRange(all, dStart, dEnd));
    totalsByDay.push({ dateKey: new Date(dStart).toISOString(), total, weekday: new Date(dStart).getDay() });
  }
  const daysWithAny = totalsByDay.filter(d => d.total > 0);
  const bestDayWeek = daysWithAny.length > 0
    ? (() => {
        const min = daysWithAny.reduce((b, d) => (d.total < b.total ? d : b));
        return { day: WEEKDAYS[min.weekday], total: min.total };
      })()
    : null;
  const worstDayWeek = daysWithAny.length > 0
    ? (() => {
        const max = daysWithAny.reduce((b, d) => (d.total > b.total ? d : b));
        return { day: WEEKDAYS[max.weekday], total: max.total };
      })()
    : null;

  // Daily series for charts (oldest → newest); for long windows use date label
  const weekSeries: { day: string; date: string; expenses: number; savings: number }[] = [];
  for (let i = W - 1; i >= 0; i--) {
    const dStart = today0 - i * DAY;
    const dEnd = dStart + DAY;
    const total = sumExpenses(expensesInRange(all, dStart, dEnd));
    const d = new Date(dStart);
    const label = W <= 14
      ? WEEKDAYS[d.getDay()].slice(0, 3)
      : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    weekSeries.push({
      day: label,
      date: d.toISOString(),
      expenses: Number(total.toFixed(2)),
      savings: savingsGoalDaily > 0 ? Number((savingsGoalDaily - total).toFixed(2)) : 0,
    });
  }

  // Control streak (days where expenses <= savings goal, going back from today)
  let controlStreak = 0;
  if (savingsGoalDaily > 0) {
    for (let i = 0; i < 60; i++) {
      const dStart = today0 - i * DAY;
      const dEnd = dStart + DAY;
      const total = sumExpenses(expensesInRange(all, dStart, dEnd));
      if (i === 0 && total === 0) {
        // skip today if no expense yet
        continue;
      }
      if (total <= savingsGoalDaily) controlStreak++;
      else break;
    }
  }

  // Best savings day (last 30 days)
  let bestSavingsDay: ExpenseAnalytics['bestSavingsDay'] = null;
  if (savingsGoalDaily > 0) {
    for (let i = 0; i < 30; i++) {
      const dStart = today0 - i * DAY;
      const dEnd = dStart + DAY;
      const total = sumExpenses(expensesInRange(all, dStart, dEnd));
      const saved = savingsGoalDaily - total;
      if (saved > 0 && (!bestSavingsDay || saved > bestSavingsDay.saved)) {
        bestSavingsDay = { date: new Date(dStart).toISOString(), saved };
      }
    }
  }

  // Today's earnings entry
  const todayEntry = entries.find(e => isSameDay(new Date(e.date), now)) ?? null;
  const earningsToday = todayEntry?.totalEarnings ?? 0;
  const profitImpact = todayTotal; // gastos extras reduzem o lucro nesse valor

  // Consciousness mode: 3+ days in last 7 over the savings goal, or weekTotal > 30% of week earnings
  let highSpendDays = 0;
  if (savingsGoalDaily > 0) {
    for (let i = 0; i < 7; i++) {
      const dStart = today0 - i * DAY;
      const dEnd = dStart + DAY;
      const total = sumExpenses(expensesInRange(all, dStart, dEnd));
      if (total > savingsGoalDaily) highSpendDays++;
    }
  }
  const weekEarnings = entries
    .filter(e => new Date(e.date).getTime() >= weekStart)
    .reduce((s, e) => s + e.totalEarnings, 0);
  const consciousnessMode =
    highSpendDays >= 3 || (weekEarnings > 0 && weekTotal > weekEarnings * 0.3);

  return {
    todayList,
    todayTotal,
    weekTotal,
    prevWeekTotal,
    weekVariation,
    weekVariationPct,
    dailyAvg,
    weekForecast,
    byCategoryToday,
    byCategoryWindow,
    windowDays: W,
    dominantCategory,
    profile,
    outOfPattern,
    recurringCategories,
    recurringGroups,
    weekSeries,
    bestDayWeek,
    worstDayWeek,
    controlStreak,
    bestSavingsDay,
    consciousnessMode,
    todayEntry,
    earningsToday,
    profitImpact,
  };
}
