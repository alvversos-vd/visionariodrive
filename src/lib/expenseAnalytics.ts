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
  bestDayWeek: { day: string; total: number } | null;
  worstDayWeek: { day: string; total: number } | null;
  controlStreak: number;
  bestSavingsDay: { date: string; saved: number } | null;
  consciousnessMode: boolean;
  todayEntry: DailyEntry | null;
  earningsToday: number;
  profitImpact: number;
}

export function computeExpenseAnalytics(savingsGoalDaily: number): ExpenseAnalytics {
  const all = getExpenses();
  const entries = getEntries();
  const now = new Date();
  const today0 = startOfDay(now).getTime();
  const yesterday0 = today0 - DAY;
  const weekStart = today0 - 6 * DAY; // last 7 days inc today
  const prevWeekStart = today0 - 13 * DAY;
  const prevWeekEnd = today0 - 6 * DAY;

  const todayList = all.filter(e => isSameDay(new Date(e.date), now));
  const todayTotal = sumExpenses(todayList);

  const weekList = expensesInRange(all, weekStart, today0 + DAY);
  const weekTotal = sumExpenses(weekList);
  const prevWeekList = expensesInRange(all, prevWeekStart, prevWeekEnd);
  const prevWeekTotal = sumExpenses(prevWeekList);

  const weekVariation = weekTotal - prevWeekTotal;
  const weekVariationPct = prevWeekTotal > 0 ? (weekVariation / prevWeekTotal) * 100 : null;

  // Daily average over last 7 days (only counting days with expenses)
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

  // Recurring categories: appears every day of the last 7 days that have any expense
  const daysWithExpense = new Set(weekList.map(e => startOfDay(new Date(e.date)).toISOString()));
  const recurringCategories: ExpenseCategory[] = [];
  if (daysWithExpense.size >= 3) {
    for (const c of EXPENSE_CATEGORIES) {
      const dayHasCat = new Set(
        weekList.filter(e => e.category === c).map(e => startOfDay(new Date(e.date)).toISOString()),
      );
      if (dayHasCat.size === daysWithExpense.size) recurringCategories.push(c);
    }
  }

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
