/**
 * Modelos canônicos do domínio Visionário Drive.
 *
 * Fonte única de verdade para Ride e FinancialEntry. Nenhum componente
 * React, service ou adapter deve duplicar essas definições.
 *
 * Esta camada é PURA: zero dependência de storage, cloud, React ou DOM.
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

export interface RideModel {
  id: string;              // UUID permanente — preservado em migrações
  date: string;            // ISO 8601
  captureMode: CaptureMode;
  value: number;
  km: number;
  durationMin?: number;
  app?: RideApp;
  vehicleId?: string;      // NUNCA o nome do veículo
  notes?: string;
  gps?: RideGpsTrace;      // só preenchido pelo PRO
}

// ─── FinancialEntry ───────────────────────────────────────────────────────
export type FinancialType = 'income' | 'bonus' | 'expense';
export type FinancialOrigin = 'manual' | 'system' | 'imported';

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

export interface FinancialEntry {
  id: string;              // UUID permanente
  date: string;            // ISO 8601
  type: FinancialType;
  origin: FinancialOrigin;
  value: number;           // sempre POSITIVO; o sinal econômico vem de `type`
  category: string;
  app?: RideApp;
  vehicleId?: string;
  relatedRideId?: string;  // futuro: vínculo bônus ↔ corrida
  notes?: string;
}

// ─── Versionamento de schema ──────────────────────────────────────────────
export const FINANCIAL_SCHEMA_VERSION = 1 as const;

export interface FinancialPayload {
  schemaVersion: number;
  entries: FinancialEntry[];
}

export function emptyFinancialPayload(): FinancialPayload {
  return { schemaVersion: FINANCIAL_SCHEMA_VERSION, entries: [] };
}
