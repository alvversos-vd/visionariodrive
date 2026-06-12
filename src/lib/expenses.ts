import { markDirty } from './cloudSync';

export const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Manutenção',
  'Pedágio',
  'Combustível extra',
  'Emergência',
  'Transporte',
  'Outros',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  date: string; // ISO
  value: number;
  category: ExpenseCategory;
  description?: string;
}

const KEY = 'lucro-delivery-expenses';

export function getExpenses(): Expense[] {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export function addExpense(input: { value: number; category: ExpenseCategory; description?: string }): Expense {
  const expense: Expense = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    value: input.value,
    category: input.category,
    description: input.description?.trim() || undefined,
  };
  const list = [expense, ...getExpenses()];
  localStorage.setItem(KEY, JSON.stringify(list));
  markDirty({ immediate: true });
  return expense;
}

export function deleteExpense(id: string): void {
  const list = getExpenses().filter(e => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
  markDirty();
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getTodayExpenses(list?: Expense[]): Expense[] {
  const all = list ?? getExpenses();
  const now = new Date();
  return all.filter(e => isSameDay(new Date(e.date), now));
}

export function sumExpenses(list: Expense[]): number {
  return list.reduce((s, e) => s + (Number(e.value) || 0), 0);
}

export function groupByCategory(list: Expense[]): Record<ExpenseCategory, { total: number; count: number }> {
  const out = {} as Record<ExpenseCategory, { total: number; count: number }>;
  for (const c of EXPENSE_CATEGORIES) out[c] = { total: 0, count: 0 };
  for (const e of list) {
    if (!out[e.category]) out[e.category] = { total: 0, count: 0 };
    out[e.category].total += Number(e.value) || 0;
    out[e.category].count += 1;
  }
  return out;
}

export function sumLastNDays(list: Expense[], days: number): number {
  const cutoff = Date.now() - days * 86400000;
  return list.filter(e => new Date(e.date).getTime() >= cutoff).reduce((s, e) => s + e.value, 0);
}
