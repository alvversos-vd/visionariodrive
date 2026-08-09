/**
 * Product Capabilities — Sprint 10.6.
 *
 * Fonte ÚNICA da verdade sobre o que cada plano do Visionário Drive pode
 * fazer. Nenhum componente, hook ou service deve inferir capacidade a partir
 * de `isPro` espalhado pelo código: todos consultam esta camada.
 *
 * Matriz oficial (Sprint 10.6):
 *
 * | Capability          | START | PRO |
 * |---------------------|-------|-----|
 * | manualRide          |  sim  | sim |
 * | quickRegister       |  sim  | sim |
 * | quickFormNative     |  sim  | sim |
 * | notifications       |  sim  | sim |
 * | gps                 |  NÃO  | sim |
 * | backgroundGps       |  NÃO  | sim |
 * | locationPermission  |  NÃO  | sim |
 * | autoKm              |  NÃO  | sim |
 *
 * Regras:
 *  - Fail-closed: enquanto o plano não é conhecido, vale START (sem GPS).
 *    Nenhuma permissão de localização pode ser pedida "por engano".
 *  - Esta camada NÃO importa GPS. Ela apenas descreve capacidades.
 */

export type ProductPlan = 'START' | 'PRO';

export interface ProductCapabilities {
  plan: ProductPlan;
  manualRide: boolean;
  quickRegister: boolean;
  quickFormNative: boolean;
  notifications: boolean;
  gps: boolean;
  backgroundGps: boolean;
  locationPermission: boolean;
  autoKm: boolean;
}

export type CapabilityKey = Exclude<keyof ProductCapabilities, 'plan'>;

function build(plan: ProductPlan): ProductCapabilities {
  const pro = plan === 'PRO';
  return {
    plan,
    manualRide: true,
    quickRegister: true,
    quickFormNative: true,
    notifications: true,
    gps: pro,
    backgroundGps: pro,
    locationPermission: pro,
    autoKm: pro,
  };
}

let current: ProductCapabilities = build('START');
const subscribers = new Set<() => void>();

/** Chamado exclusivamente pelo AuthContext quando o perfil/plano muda. */
export function setProductPlan(plan: ProductPlan): void {
  if (current.plan === plan) return;
  current = build(plan);
  for (const fn of subscribers) {
    try { fn(); } catch { /* noop */ }
  }
}

export function getCapabilities(): ProductCapabilities {
  return current;
}

export function hasCapability(key: CapabilityKey): boolean {
  return current[key];
}

export function subscribeCapabilities(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

/** Reset — uso exclusivo de testes. */
export function __resetCapabilities(): void {
  current = build('START');
}
