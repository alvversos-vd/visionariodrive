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

  // Recurring detection: group similar expenses by category + normalized description.
  // Avoid false positives by requiring ≥3 distinct days and value variance under 50%.
  function normalizeDesc(s?: string) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  const groups = new Map<string, { category: ExpenseCategory; label: string; days: Set<string>; values: number[] }>();
  for (const e of weekList) {
    const desc = normalizeDesc(e.description);
    const key = `${e.category}::${desc}`;
    const dayKey = startOfDay(new Date(e.date)).toISOString();
    const g = groups.get(key) ?? {
      category: e.category,
      label: e.description?.trim() || e.category,
      days: new Set<string>(),
      values: [],
    };
    g.days.add(dayKey);
    g.values.push(e.value);
    groups.set(key, g);
  }
  const recurringGroups: { category: ExpenseCategory; label: string; days: number; avg: number }[] = [];
  for (const g of groups.values()) {
    if (g.days.size < 3) continue;
    const avg = g.values.reduce((s, v) => s + v, 0) / g.values.length;
    if (avg <= 0) continue;
    const min = Math.min(...g.values);
    const max = Math.max(...g.values);
    // similarity: max within 50% of avg
    if ((max - min) / avg > 1.0) continue;
    recurringGroups.push({ category: g.category, label: g.label, days: g.days.size, avg });
  }
  recurringGroups.sort((a, b) => b.days - a.days);
  // Backwards compat: keep a flat category list (unique) of recurring items
  const recurringCategories: ExpenseCategory[] = Array.from(
    new Set(recurringGroups.map(r => r.category)),
  );

  // Best / worst day in last 7 (by weekday)
  const totalsByDay: { dateKey: string; total: number; weekday: number }[] = [];
  for (let i = 0; i < 7; i++) {
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

  // Daily series (last 7 days, oldest → newest) for charts
  const weekSeries: { day: string; date: string; expenses: number; savings: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dStart = today0 - i * DAY;
    const dEnd = dStart + DAY;
    const total = sumExpenses(expensesInRange(all, dStart, dEnd));
    const wd = new Date(dStart).getDay();
    weekSeries.push({
      day: WEEKDAYS[wd].slice(0, 3),
      date: new Date(dStart).toISOString(),
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
