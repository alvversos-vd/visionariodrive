import { DailyEntry } from './types';
import { Expense } from './expenses';

/**
 * Agregação read-side de gastos avulsos no histórico.
 *
 * Não altera storage, sync, DailyEntry nem o modelo Expense.
 * Devolve cópias dos DailyEntry com totalCost / profit recalculados
 * incluindo os gastos do mesmo dia, e cria entradas sintéticas
 * (expenseOnly) para dias que têm apenas gastos sem turno registrado.
 */

export interface AdjustedDailyEntry extends DailyEntry {
  /** Soma dos gastos avulsos do dia (Expense[]) aplicada a este entry. */
  expensesExtra: number;
  /** True quando o entry foi sintetizado apenas a partir de gastos (sem turno). */
  expenseOnly?: boolean;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function sumExpensesByDay(expenses: Expense[]): Map<string, { total: number; items: Expense[] }> {
  const map = new Map<string, { total: number; items: Expense[] }>();
  for (const e of expenses) {
    const k = dayKey(e.date);
    const cur = map.get(k) || { total: 0, items: [] };
    cur.total += Number(e.value) || 0;
    cur.items.push(e);
    map.set(k, cur);
  }
  return map;
}

/**
 * Devolve nova lista de entries com gastos somados em totalCost e profit
 * recalculados. Para dias com apenas gastos (sem nenhum DailyEntry),
 * cria entrada sintética com expenseOnly=true.
 *
 * A ordem final é por data desc.
 */
export function mergeExpensesIntoEntries(
  entries: DailyEntry[],
  expenses: Expense[],
): AdjustedDailyEntry[] {
  const byDay = sumExpensesByDay(expenses);
  const usedDays = new Set<string>();

  const adjusted: AdjustedDailyEntry[] = entries.map(e => {
    const k = dayKey(e.date);
    const extra = byDay.get(k)?.total ?? 0;
    if (extra > 0) usedDays.add(k);
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

  // Marca como usados também os dias que tinham entry mesmo sem gasto
  entries.forEach(e => usedDays.add(dayKey(e.date)));

  // Cria sintéticos para dias com gasto e sem entry
  for (const [k, v] of byDay.entries()) {
    if (usedDays.has(k)) continue;
    // Usa a data do primeiro gasto do dia para preservar timezone local
    const sample = v.items[0];
    const synthetic: AdjustedDailyEntry = {
      id: `expense-only-${k}`,
      date: sample.date,
      hoursWorked: 0,
      kmDriven: 0,
      totalEarnings: 0,
      fuelPrice: 0,
      vehicleConsumption: 0,
      installment: 0,
      maintenance: 0,
      insurance: 0,
      otherCosts: 0,
      litersConsumed: 0,
      fuelCost: 0,
      monthlyFixedCosts: 0,
      dailyFixedCost: 0,
      totalCost: v.total,
      profit: -v.total,
      profitPerHour: 0,
      profitPerKm: 0,
      expensesExtra: v.total,
      expenseOnly: true,
    };
    adjusted.push(synthetic);
  }

  adjusted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return adjusted;
}
