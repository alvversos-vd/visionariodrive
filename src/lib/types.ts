export interface DailyEntry {
  id: string;
  date: string;
  hoursWorked: number;
  kmDriven: number;
  totalEarnings: number;
  fuelPrice: number;
  vehicleConsumption: number;
  installment: number;
  maintenance: number;
  insurance: number;
  otherCosts: number;
  // Optional segmentation
  vehicle?: string;
  rideType?: string;
  // Calculated
  litersConsumed: number;
  fuelCost: number;
  monthlyFixedCosts: number;
  dailyFixedCost: number;
  totalCost: number;
  profit: number;
  profitPerHour: number;
  profitPerKm: number;
}

export interface RideEntry {
  id: string;
  date: string;
  value: number;
  km: number;
  costPerKm: number;
  minIdealKm: number;
  ridePerKm: number;
  profit: number; // value - costPerKm * km
  verdict: 'good' | 'ok' | 'bad';
  vehicle?: string;
  rideType?: string;
}

export interface Goals {
  daily: number;
  weekly: number;
  monthly: number;
}

// Backwards compatibility
export interface DailyGoal {
  amount: number;
}

export interface AppSettings {
  profitMargin: number; // ex: 1.3 = 30%
  currency: string; // 'BRL'
  estimatedHours: number; // jornada estimada do dia (para previsão)
}

export const DEFAULT_SETTINGS: AppSettings = {
  profitMargin: 1.3,
  currency: 'BRL',
  estimatedHours: 8,
};

export const DEFAULT_GOALS: Goals = {
  daily: 0,
  weekly: 0,
  monthly: 0,
};

export function calculateEntry(input: {
  hoursWorked: number;
  kmDriven: number;
  totalEarnings: number;
  fuelPrice: number;
  vehicleConsumption: number;
  installment: number;
  maintenance: number;
  insurance: number;
  otherCosts: number;
}): Omit<DailyEntry, 'id' | 'date'> {
  const litersConsumed = input.vehicleConsumption > 0 ? input.kmDriven / input.vehicleConsumption : 0;
  const fuelCost = litersConsumed * input.fuelPrice;
  const monthlyFixedCosts = input.installment + input.maintenance + input.insurance + input.otherCosts;
  const dailyFixedCost = monthlyFixedCosts / 30;
  const totalCost = fuelCost + dailyFixedCost;
  const profit = input.totalEarnings - totalCost;
  const profitPerHour = input.hoursWorked > 0 ? profit / input.hoursWorked : 0;
  const profitPerKm = input.kmDriven > 0 ? profit / input.kmDriven : 0;

  return {
    ...input,
    litersConsumed,
    fuelCost,
    monthlyFixedCosts,
    dailyFixedCost,
    totalCost,
    profit,
    profitPerHour,
    profitPerKm,
  };
}

// --- Performance helpers ---

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export interface PerformanceStats {
  todayEntry: DailyEntry | null;
  weekTotal: number;
  weekProfit: number;
  weekAvgProfit: number;
  lastWeekProfit: number;
  weekChangePct: number | null;
  costChangePct: number | null;
  bestDayOfWeek: { day: string; avg: number } | null;
  bestDay: DailyEntry | null;
  recordProfit: number;
  streak: number; // consecutive days hitting daily goal
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function computeStats(entries: DailyEntry[], dailyGoal: number): PerformanceStats {
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
  const costChangePct = lastWeekCost > 0
    ? ((weekCost - lastWeekCost) / lastWeekCost) * 100
    : null;

  // Best day of week (avg profit by weekday)
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
    (best, e) => (!best || e.profit > best.profit ? e : best),
    null
  );
  const recordProfit = bestDay?.profit ?? 0;

  // Streak: consecutive days from today (or yesterday) hitting goal
  let streak = 0;
  if (dailyGoal > 0) {
    const sorted = [...entries].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    let cursor = today;
    // If no entry today, start from yesterday
    const hasToday = sorted.some(e => isSameDay(new Date(e.date), cursor));
    if (!hasToday) cursor = new Date(today.getTime() - 86400000);

    for (;;) {
      const entry = sorted.find(e => isSameDay(new Date(e.date), cursor));
      if (entry && entry.profit >= dailyGoal) {
        streak += 1;
        cursor = new Date(cursor.getTime() - 86400000);
      } else break;
    }
  }

  return {
    todayEntry,
    weekTotal,
    weekProfit,
    weekAvgProfit,
    lastWeekProfit,
    weekChangePct,
    costChangePct,
    bestDayOfWeek,
    bestDay,
    recordProfit,
    streak,
  };
}
