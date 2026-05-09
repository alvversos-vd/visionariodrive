import { markDirty } from './cloudSync';

const KEY = 'lucro-delivery-vehicles-v2';
const ACTIVE_KEY = 'lucro-delivery-vehicle-active';
const LAST_APP_KEY = 'lucro-delivery-last-app';

export type TipoVeiculo = 'moto' | 'carro' | 'bike' | 'bike_eletrica';
export type TipoCombustivel = 'gasolina' | 'etanol' | 'diesel' | 'eletrico' | 'nenhum';

export interface Vehicle {
  veiculo_id: string;
  tipo_veiculo: TipoVeiculo;
  nome_veiculo: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  placa?: string;
  km_por_litro: number | null;
  tipo_combustivel: TipoCombustivel;
  valor_combustivel_litro: number;
  custo_fixo_mensal: number;
  ativo: boolean;
  data_criacao: string;
}

export const TIPO_LABEL: Record<TipoVeiculo, string> = {
  moto: '🏍️ Moto',
  carro: '🚗 Carro',
  bike: '🚲 Bike',
  bike_eletrica: '⚡ Bike elétrica',
};

export const APPS = ['iFood', 'Uber', '99', 'Lalamove', 'Rappi', 'Mercado Livre', 'Shopee', 'Outro'] as const;
export type AppEntrega = typeof APPS[number];

export function getVehiclesV2(): Vehicle[] {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

function save(list: Vehicle[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  markDirty();
}

export function addVehicle(v: Omit<Vehicle, 'veiculo_id' | 'data_criacao' | 'ativo'> & { ativo?: boolean }): Vehicle {
  const list = getVehiclesV2();
  const vehicle: Vehicle = {
    ...v,
    veiculo_id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ativo: v.ativo ?? true,
    data_criacao: new Date().toISOString(),
  };
  list.unshift(vehicle);
  save(list);
  if (!getActiveVehicleId()) setActiveVehicleId(vehicle.veiculo_id);
  return vehicle;
}

export function updateVehicle(id: string, patch: Partial<Vehicle>) {
  const list = getVehiclesV2();
  const i = list.findIndex(v => v.veiculo_id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...patch };
  save(list);
}

export function deleteVehicle(id: string) {
  save(getVehiclesV2().filter(v => v.veiculo_id !== id));
  if (getActiveVehicleId() === id) {
    const remaining = getVehiclesV2()[0];
    setActiveVehicleId(remaining?.veiculo_id ?? null);
  }
}

export function getActiveVehicleId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveVehicleId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  markDirty();
}

export function getActiveVehicle(): Vehicle | null {
  const id = getActiveVehicleId();
  if (!id) return getVehiclesV2()[0] ?? null;
  return getVehiclesV2().find(v => v.veiculo_id === id) ?? null;
}

export function getVehicleById(id: string | undefined | null): Vehicle | null {
  if (!id) return null;
  return getVehiclesV2().find(v => v.veiculo_id === id) ?? null;
}

export function getLastApp(): AppEntrega | null {
  const v = localStorage.getItem(LAST_APP_KEY);
  return (v as AppEntrega) || null;
}

export function setLastApp(app: AppEntrega) {
  localStorage.setItem(LAST_APP_KEY, app);
  markDirty();
}

export function hasAnyVehicle(): boolean {
  return getVehiclesV2().length > 0;
}

export function vehicleCostPerKm(v: Vehicle | null): number {
  if (!v) return 0;
  const fuel = v.km_por_litro && v.km_por_litro > 0
    ? v.valor_combustivel_litro / v.km_por_litro
    : 0;
  // custo fixo rateado por km não é direto — manter só combustível por km aqui
  return fuel;
}
