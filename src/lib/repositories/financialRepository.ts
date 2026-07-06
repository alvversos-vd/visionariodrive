/**
 * FinancialRepository — owner físico de `vd-financial` (versionado).
 *
 * Migra automaticamente de `lucro-delivery-expenses` (legacy) na primeira leitura.
 * Espelha entries `expense` de volta para a chave legacy para manter clientes
 * antigos e cloud sync funcionando durante a transição.
 */

import { markDirty } from '../cloudSync';
import { eventBus } from '../eventBus';
import {
  FinancialEntry,
  FinancialPayload,
  FINANCIAL_SCHEMA_VERSION,
  emptyFinancialPayload,
} from '../domain/models';

export const FINANCIAL_STORAGE_KEY = 'vd-financial';
const LEGACY_EXPENSES_KEY = 'lucro-delivery-expenses';

interface LegacyExpense {
  id: string;
  date: string;
  value: number;
  category: string;
  description?: string;
}

function migrateLegacyExpenses(): FinancialEntry[] {
  const raw = localStorage.getItem(LEGACY_EXPENSES_KEY);
  if (!raw) return [];
  let legacy: LegacyExpense[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) legacy = parsed;
  } catch { return []; }
  return legacy
    .filter(e => e && typeof e.id === 'string')
    .map<FinancialEntry>(e => ({
      id: e.id,
      date: e.date,
      type: 'expense',
      origin: 'manual',
      value: Number(e.value) || 0,
      category: e.category || 'Outros',
      notes: e.description?.trim() || undefined,
    }));
}

function mirrorExpensesToLegacy(entries: FinancialEntry[]): void {
  const expenses: LegacyExpense[] = entries
    .filter(e => e.type === 'expense')
    .map(e => ({
      id: e.id,
      date: e.date,
      value: e.value,
      category: e.category,
      description: e.notes,
    }));
  localStorage.setItem(LEGACY_EXPENSES_KEY, JSON.stringify(expenses));
}

export const financialRepository = {
  read(): FinancialPayload {
    const raw = localStorage.getItem(FINANCIAL_STORAGE_KEY);
    if (!raw) {
      const migrated = migrateLegacyExpenses();
      const payload: FinancialPayload = {
        schemaVersion: FINANCIAL_SCHEMA_VERSION,
        entries: migrated,
      };
      this.write(payload, { markCloud: false });
      return payload;
    }
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.schemaVersion === 'number' &&
        Array.isArray(parsed.entries)
      ) return parsed as FinancialPayload;
    } catch { /* fallthrough */ }
    return emptyFinancialPayload();
  },

  write(payload: FinancialPayload, opts: { markCloud?: boolean } = {}): void {
    localStorage.setItem(FINANCIAL_STORAGE_KEY, JSON.stringify(payload));
    mirrorExpensesToLegacy(payload.entries);
    if (opts.markCloud !== false) {
      markDirty({ immediate: true });
      eventBus.emit('financial:changed');
    }
  },
};
