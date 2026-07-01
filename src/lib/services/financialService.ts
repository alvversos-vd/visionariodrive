/**
 * FinancialService — fonte única de verdade para entradas financeiras
 * (income, bonus, expense). Não conhece corridas, GPS, lucro.
 *
 * Consome APENAS financialRepository.
 */

import { financialRepository } from '../repositories/financialRepository';
import {
  FinancialEntry,
  FinancialType,
} from '../domain/models';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function isSameDay(a: string, b: string): boolean { return dayKey(a) === dayKey(b); }
function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export interface ListFilters {
  type?: FinancialType | FinancialType[];
  from?: Date;
  to?: Date;
}

export interface NewEntryInput {
  type: FinancialType;
  value: number;
  category: string;
  date?: string;
  origin?: 'manual' | 'system' | 'imported';
  app?: FinancialEntry['app'];
  vehicleId?: string;
  relatedRideId?: string;
  notes?: string;
}

export const financialService = {
  list(filters: ListFilters = {}): FinancialEntry[] {
    let entries = financialRepository.read().entries.slice();
    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      entries = entries.filter(e => types.includes(e.type));
    }
    if (filters.from || filters.to) {
      const from = filters.from ?? new Date(0);
      const to = filters.to ?? new Date(8640000000000000);
      entries = entries.filter(e => inRange(e.date, from, to));
    }
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  },

  add(input: NewEntryInput): FinancialEntry {
    if (!input.type) throw new Error('FinancialService.add: type é obrigatório');
    const value = Math.abs(Number(input.value) || 0);
    if (value <= 0) throw new Error('FinancialService.add: value deve ser > 0');

    const entry: FinancialEntry = {
      id: newId(),
      date: input.date ?? new Date().toISOString(),
      type: input.type,
      origin: input.origin ?? 'manual',
      value,
      category: input.category?.trim() || 'Outros',
      app: input.app,
      vehicleId: input.vehicleId,
      relatedRideId: input.relatedRideId,
      notes: input.notes?.trim() || undefined,
    };
    const payload = financialRepository.read();
    financialRepository.write({ ...payload, entries: [entry, ...payload.entries] });
    return entry;
  },

  update(id: string, patch: Partial<Omit<FinancialEntry, 'id'>>): FinancialEntry | null {
    const payload = financialRepository.read();
    const i = payload.entries.findIndex(e => e.id === id);
    if (i < 0) return null;
    const next: FinancialEntry = { ...payload.entries[i], ...patch, id };
    if (patch.value !== undefined) next.value = Math.abs(Number(patch.value) || 0);
    payload.entries[i] = next;
    financialRepository.write(payload);
    return next;
  },

  remove(id: string): void {
    const payload = financialRepository.read();
    const next = payload.entries.filter(e => e.id !== id);
    if (next.length === payload.entries.length) return;
    financialRepository.write({ ...payload, entries: next });
  },

  sumByType(filters: ListFilters = {}): Record<FinancialType, number> {
    const out: Record<FinancialType, number> = { income: 0, bonus: 0, expense: 0 };
    for (const e of this.list(filters)) out[e.type] += e.value;
    return out;
  },

  sumByDay(date: Date | string): Record<FinancialType, number> {
    const iso = typeof date === 'string' ? date : date.toISOString();
    const out: Record<FinancialType, number> = { income: 0, bonus: 0, expense: 0 };
    for (const e of financialRepository.read().entries) {
      if (isSameDay(e.date, iso)) out[e.type] += e.value;
    }
    return out;
  },

  sumRange(from: Date, to: Date): Record<FinancialType, number> {
    return this.sumByType({ from, to });
  },

  groupByApp(filters: ListFilters = {}): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.list(filters)) {
      const key = e.app ?? '—';
      out[key] = (out[key] ?? 0) + e.value;
    }
    return out;
  },

  groupByCategory(filters: ListFilters = {}): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of this.list(filters)) {
      out[e.category] = (out[e.category] ?? 0) + e.value;
    }
    return out;
  },
};

export type FinancialService = typeof financialService;
