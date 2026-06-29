/**
 * MetricsService — único responsável por calcular indicadores financeiros.
 *
 * Consome RideService (corridas) e FinancialService (despesas/bônus/receitas)
 * e devolve métricas prontas para a UI.
 *
 * Em Fase 1 o RideService ainda não está implementado: as corridas são lidas
 * via adapter encapsulado sobre o storage legacy de DailyEntry/RideEntry. Esse
 * adapter vive APENAS aqui — nenhum componente deve replicar essa leitura.
 * Quando o RideService for ativado (Fase 2/3), este arquivo é o único ponto
 * de troca.
 */

import { computeStats, type DailyEntry, type PerformanceStats } from '../types';
import { getEntries } from '../storage';
import { financialService } from './financialService';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export interface DayMetrics {
  date: string;
  grossEarnings: number;     // entradas brutas (corridas) do dia
  bonus: number;             // soma de FinancialEntry.bonus do dia
  income: number;            // outras receitas
  expense: number;           // despesas extras do dia
  totalCost: number;         // custo do dia (combustível + fixos) + despesas
  netProfit: number;         // lucro líquido = gross + bonus + income - totalCost
  km: number;
  hoursWorked: number;
  profitPerHour: number;
  profitPerKm: number;
  /** Acesso bruto ao DailyEntry do dia (útil enquanto o RideService não migra). */
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

/**
 * Snapshot completo consumido pelo Dashboard. Inclui o `PerformanceStats`
 * legacy (recorde, streak, melhor dia, comparativo semanal) já calculado
 * para que o componente não precise importar `computeStats` diretamente.
 */
export interface DashboardSnapshot {
  today: DayMetrics;
  stats: PerformanceStats;
  entriesCount: number;
  expensesByCategory: Record<string, number>;
}

function emptyDayMetrics(date: Date): DayMetrics {
  return {
    date: date.toISOString(),
    grossEarnings: 0,
    bonus: 0,
    income: 0,
    expense: 0,
    totalCost: 0,
    netProfit: 0,
    km: 0,
    hoursWorked: 0,
    profitPerHour: 0,
    profitPerKm: 0,
    rawEntry: null,
  };
}

export const metricsService = {
  dayMetrics(date: Date = new Date()): DayMetrics {
    const entries = getEntries();
    const rawEntry = entries.find(e => isSameDay(new Date(e.date), date)) ?? null;
    const sums = financialService.sumByDay(date);

    const base = emptyDayMetrics(date);
    if (rawEntry) {
      base.grossEarnings = rawEntry.totalEarnings;
      base.km = rawEntry.kmDriven;
      base.hoursWorked = rawEntry.hoursWorked;
      base.totalCost = rawEntry.totalCost;
      base.rawEntry = rawEntry;
    }
    base.bonus = sums.bonus;
    base.income = sums.income;
    base.expense = sums.expense;
    base.totalCost += sums.expense;
    base.netProfit =
      base.grossEarnings + base.bonus + base.income - base.totalCost;
    base.profitPerHour = base.hoursWorked > 0 ? base.netProfit / base.hoursWorked : 0;
    base.profitPerKm = base.km > 0 ? base.netProfit / base.km : 0;
    return base;
  },

  rangeMetrics(from: Date, to: Date): RangeMetrics {
    const f = startOfDay(from);
    const t = endOfDay(to);
    const entries = getEntries().filter(e => {
      const d = new Date(e.date).getTime();
      return d >= f.getTime() && d <= t.getTime();
    });
    const fin = financialService.sumRange(f, t);

    const gross = entries.reduce((s, e) => s + e.totalEarnings, 0);
    const km    = entries.reduce((s, e) => s + e.kmDriven, 0);
    const hours = entries.reduce((s, e) => s + e.hoursWorked, 0);
    const cost  = entries.reduce((s, e) => s + e.totalCost, 0) + fin.expense;
    const net   = gross + fin.bonus + fin.income - cost;

    return {
      from: f.toISOString(),
      to: t.toISOString(),
      grossEarnings: gross,
      bonus: fin.bonus,
      income: fin.income,
      expense: fin.expense,
      totalCost: cost,
      netProfit: net,
      km,
      hoursWorked: hours,
    };
  },

  /**
   * Snapshot consumido pelo Dashboard. Encapsula `computeStats` e o ajuste
   * de despesas/bônus/receitas para que o componente nunca toque storage
   * nem regra de negócio.
   */
  dashboardSnapshot(goalDaily: number): DashboardSnapshot {
    const entries = getEntries();
    const stats = computeStats(entries, goalDaily);
    const today = this.dayMetrics(new Date());
    const dayStart = startOfDay(new Date());
    const dayEnd = endOfDay(new Date());
    const expensesByCategory = financialService.groupByCategory({
      type: 'expense',
      from: dayStart,
      to: dayEnd,
    });
    return {
      today,
      stats,
      entriesCount: entries.length,
      expensesByCategory,
    };
  },
};

export type MetricsService = typeof metricsService;
