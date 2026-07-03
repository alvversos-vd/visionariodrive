/**
 * Modelos canônicos do domínio Visionário Drive.
 *
 * Fonte única de verdade para Ride e FinancialEntry. Nenhum componente
 * React, service ou adapter deve duplicar essas definições.
 *
 * Esta camada é PURA: zero dependência de storage, cloud, React ou DOM.
 *
 * ─── Estabilidade ───────────────────────────────────────────────────────
 * Sprint 1.6 congela `RideModel v1` e `FinancialEntry v1`.
 * Novos campos DEVEM entrar como opcionais para não quebrar consumidores.
 * Remoção de campo → nova versão de schema + migração formal.
 */

// ─── Apps de corrida (não confundir com "plataforma" Android/iOS/Web) ──────
export const RIDE_APPS = [
  'Uber',
  '99',
  'InDrive',
  'Lalamove',
  'iFood',
  'Rappi',
  'Mercado Livre',
  'Shopee',
  'Outro',
] as const;
export type RideApp = (typeof RIDE_APPS)[number];

// ─── Ride ─────────────────────────────────────────────────────────────────
export type CaptureMode = 'manual' | 'quick' | 'gps' | 'imported';

export interface RideGpsTrace {
  polyline?: string;
  accuracy?: number;
  points?: number;
}

export interface RideLocation {
  lat: number;
  lng: number;
  label?: string;
  at?: string;                    // ISO
}

export interface RideEarningsBreakdown {
  base?: number;
  surge?: number;
  tip?: number;
  bonus?: number;
  toll?: number;
  other?: number;
}

/**
 * RideModel v1 — CONGELADO na Sprint 1.6.
 * Campos opcionais reservados para Fase 2 (Ride Unificado):
 *   startedAt/endedAt/startLocation/endLocation/earningsBreakdown/shiftId
 * Nenhuma tela deve consumi-los ainda.
 */
export interface RideModel {
  id: string;                     // UUID permanente — preservado em migrações
  date: string;                   // ISO 8601 (compat: momento canônico da corrida)
  captureMode: CaptureMode;
  value: number;
  km: number;
  durationMin?: number;
  app?: RideApp;
  vehicleId?: string;             // NUNCA o nome do veículo
  notes?: string;
  gps?: RideGpsTrace;             // só preenchido pelo PRO

  // ─── Reservados para Fase 2 (não usar ainda) ───
  startedAt?: string;             // ISO — início real da corrida
  endedAt?: string;               // ISO — fim real da corrida
  startLocation?: RideLocation;
  endLocation?: RideLocation;
  earningsBreakdown?: RideEarningsBreakdown;
  shiftId?: string;               // vínculo com turno de origem
}

// ─── FinancialEntry ───────────────────────────────────────────────────────
export type FinancialType = 'income' | 'bonus' | 'expense';

/**
 * Origem de uma entrada financeira.
 * Ampliada na Sprint 1.6 para preparar OCR / import / IA / integrações
 * bancárias. Escrita atual usa apenas 'manual' / 'system' / 'imported'.
 */
export type FinancialOrigin =
  | 'manual'
  | 'system'
  | 'imported'
  | 'ocr'
  | 'ai'
  | 'bank_import';

export const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Manutenção',
  'Pedágio',
  'Combustível extra',
  'Emergência',
  'Transporte',
  'Outros',
] as const;

export const BONUS_CATEGORIES = [
  'Meta diária',
  'Promoção',
  'Campanha',
  'Indicação',
  'Quality',
  'Outro',
] as const;

export const INCOME_CATEGORIES = [
  'Cashback',
  'Reembolso',
  'Gorjeta',
  'Outro',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type BonusCategory = (typeof BONUS_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type FinancialCategory = ExpenseCategory | BonusCategory | IncomeCategory;

export function categoriesOf(type: FinancialType): readonly string[] {
  switch (type) {
    case 'expense': return EXPENSE_CATEGORIES;
    case 'bonus':   return BONUS_CATEGORIES;
    case 'income':  return INCOME_CATEGORIES;
  }
}

export interface FinancialAttachment {
  id: string;
  kind: 'image' | 'pdf' | 'link';
  url?: string;                   // remoto (Fase 2+)
  localRef?: string;              // Blob/OPFS handle local
  mime?: string;
  size?: number;
  createdAt: string;              // ISO
}

/**
 * FinancialEntry v1 — CONGELADO na Sprint 1.6.
 * Campos opcionais reservados para Fase 2:
 *   recurrenceId (recorrência) / attachments (anexos) / sourceRef (import)
 */
export interface FinancialEntry {
  id: string;                     // UUID permanente
  date: string;                   // ISO 8601
  type: FinancialType;
  origin: FinancialOrigin;
  value: number;                  // sempre POSITIVO; o sinal econômico vem de `type`
  category: string;
  app?: RideApp;
  vehicleId?: string;
  relatedRideId?: string;         // vínculo bônus ↔ corrida
  notes?: string;

  // ─── Reservados para Fase 2 (não usar ainda) ───
  recurrenceId?: string;          // agrupa parcelas/recorrências
  attachments?: FinancialAttachment[];
  sourceRef?: string;             // id externo (extrato, OCR, integração)
}

// ─── Versionamento de schema ──────────────────────────────────────────────
/**
 * Versão oficial de cada payload persistido. Novas versões DEVEM ter
 * migrador em `BaseRepository.readVersioned`.
 * Toda entidade nova nasce com `SCHEMA_VERSION = 1`.
 */
export const FINANCIAL_SCHEMA_VERSION = 1 as const;
export const RIDE_SCHEMA_VERSION = 1 as const;
export const VEHICLES_SCHEMA_VERSION = 1 as const;
export const GOALS_SCHEMA_VERSION = 1 as const;
export const SETTINGS_SCHEMA_VERSION = 1 as const;
export const PROFILE_SCHEMA_VERSION = 1 as const;

export interface FinancialPayload {
  schemaVersion: number;
  entries: FinancialEntry[];
}

export function emptyFinancialPayload(): FinancialPayload {
  return { schemaVersion: FINANCIAL_SCHEMA_VERSION, entries: [] };
}

/**
 * Payload unificado de corridas — Fase 2.1.
 * Persistido em `localStorage['vd-rides']` e espelhado em `user_data.rides_v2`.
 * Substitui a fragmentação anterior (RideEntry / DailyEntry.rides / Shift.rides).
 */
export interface RidePayload {
  schemaVersion: number;
  rides: RideModel[];
}

export function emptyRidePayload(): RidePayload {
  return { schemaVersion: RIDE_SCHEMA_VERSION, rides: [] };
}
