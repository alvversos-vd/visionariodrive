/**
 * FinancialService — fonte única de verdade para despesas, bônus e receitas extras.
 *
 * Responsabilidades:
 *  - persistir FinancialEntry em `vd-financial` (versionado).
 *  - migrar automaticamente de `lucro-delivery-expenses` (legacy) na primeira leitura,
 *    preservando IDs, datas e valores.
 *  - espelhar entries do tipo `expense` de volta para `lucro-delivery-expenses`
 *    para compatibilidade com clientes ainda não migrados (rollback / cloud sync).
 *
 * Nunca calcula lucro. Nunca conhece corridas. Nunca conhece GPS.
 */

import { markDirty } from '../cloudSync';
import {
  FinancialEntry,
  FinancialPayload,
  FinancialType,
  FINANCIAL_SCHEMA_VERSION,
  emptyFinancialPayload,
} from '../domain/models';

export const FINANCIAL_STORAGE_KEY = 'vd-financial';
const LEGACY_EXPENSES_KEY = 'lucro-delivery-expenses';

// ─── Tipo legacy preservado para migração in-place (não importar de fora) ─
interface LegacyExpense {
  id: string;
  date: string;
  value: number;
  category: string;
  description?: string;
}

// ─── Util ─────────────────────────────────────────────────────────────────
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

function isSameDay(isoA: string, isoB: string): boolean {
  return dayKey(isoA) === dayKey(isoB);
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

// ─── Migração legacy → canônico ───────────────────────────────────────────
function migrateLegacyExpenses(): FinancialEntry[] {
  const raw = localStorage.getItem(LEGACY_EXPENSES_KEY);
  if (!raw) return [];
  let legacy: LegacyExpense[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) legacy = parsed;
  } catch {
    return [];
  }
  return legacy
    .filter(e => e && typeof e.id === 'string')
    .map<FinancialEntry>(e => ({
      id: e.id,                                      // preserva UUID
      date: e.date,
      type: 'expense',
      origin: 'manual',
      value: Number(e.value) || 0,
      category: e.category || 'Outros',
      notes: e.description?.trim() || undefined,
    }));
}

// ─── Leitura/escrita do storage versionado ────────────────────────────────
function readPayload(): FinancialPayload {
  const raw = localStorage.getItem(FINANCIAL_STORAGE_KEY);

  if (!raw) {
    // primeira execução: migra do legacy (NÃO apaga a chave antiga)
    const migrated = migrateLegacyExpenses();
    const payload: FinancialPayload = {
      schemaVersion: FINANCIAL_SCHEMA_VERSION,
      entries: migrated,
    };
    writePayload(payload, { markCloud: false });
    return payload;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.schemaVersion === 'number' &&
      Array.isArray(parsed.entries)
    ) {
      // futuras migrações entre schemaVersions entram aqui
      return parsed as FinancialPayload;
    }
  } catch {
    /* fallthrough */
  }
  return emptyFinancialPayload();
}

function writePayload(payload: FinancialPayload, opts?: { markCloud?: boolean }): void {
  localStorage.setItem(FINANCIAL_STORAGE_KEY, JSON.stringify(payload));
  mirrorExpensesToLegacy(payload.entries);
  if (opts?.markCloud !== false) markDirty({ immediate: true });
}

/**
 * Mantém `lucro-delivery-expenses` em sincronia com as entries do tipo `expense`,
 * para que clientes antigos (ainda lendo a chave antiga) continuem funcionando
 * durante a transição. Apenas espelho — nunca fonte de verdade depois da migração.
 */
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

// ─── API pública ──────────────────────────────────────────────────────────
export interface ListFilters {
  type?: FinancialType | FinancialType[];
  from?: Date;
  to?: Date;
}

export interface NewEntryInput {
  type: FinancialType;
  value: number;
  category: string;
  date?: string;          // default: agora
  origin?: 'manual' | 'system' | 'imported';
  app?: FinancialEntry['app'];
  vehicleId?: string;
  relatedRideId?: string;
  notes?: string;
}

export const financialService = {
  list(filters: ListFilters = {}): FinancialEntry[] {
    let entries = readPayload().entries.slice();
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

    const payload = readPayload();
    writePayload({ ...payload, entries: [entry, ...payload.entries] });
    return entry;
  },

  update(id: string, patch: Partial<Omit<FinancialEntry, 'id'>>): FinancialEntry | null {
    const payload = readPayload();
    const i = payload.entries.findIndex(e => e.id === id);
    if (i < 0) return null;
    const next: FinancialEntry = { ...payload.entries[i], ...patch, id };
    if (patch.value !== undefined) next.value = Math.abs(Number(patch.value) || 0);
    payload.entries[i] = next;
    writePayload(payload);
    return next;
  },

  remove(id: string): void {
    const payload = readPayload();
    const next = payload.entries.filter(e => e.id !== id);
    if (next.length === payload.entries.length) return;
    writePayload({ ...payload, entries: next });
  },

  // ─── Agregações puras (sem cálculo de lucro) ────────────────────────────
  sumByType(filters: ListFilters = {}): Record<FinancialType, number> {
    const out: Record<FinancialType, number> = { income: 0, bonus: 0, expense: 0 };
    for (const e of this.list(filters)) out[e.type] += e.value;
    return out;
  },

  sumByDay(date: Date | string): Record<FinancialType, number> {
    const iso = typeof date === 'string' ? date : date.toISOString();
    const out: Record<FinancialType, number> = { income: 0, bonus: 0, expense: 0 };
    for (const e of readPayload().entries) {
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
