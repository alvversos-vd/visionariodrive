/**
 * VehicleService — única API que componentes usam para veículos e app ativo.
 * Consome APENAS vehicleRepository.
 */

import { vehicleRepository, type Vehicle, type AppEntrega } from '../repositories/vehicleRepository';

export const vehicleService = {
  list(): Vehicle[] { return vehicleRepository.list(); },
  add: vehicleRepository.add,
  update: vehicleRepository.update,
  remove: vehicleRepository.remove,
  getById(id: string | null | undefined): Vehicle | null { return vehicleRepository.getById(id); },
  getActive(): Vehicle | null { return vehicleRepository.getActive(); },
  getActiveId(): string | null { return vehicleRepository.getActiveId(); },
  setActive(id: string | null): void { vehicleRepository.setActiveId(id); },
  hasAny(): boolean { return vehicleRepository.hasAny(); },
  costPerKm(v: Vehicle | null): number { return vehicleRepository.costPerKm(v); },
  getName(id: string | null | undefined): string {
    const v = vehicleRepository.getById(id);
    return v?.nome_veiculo ?? '';
  },
  getLastApp(): AppEntrega | null { return vehicleRepository.getLastApp(); },
  setLastApp(app: AppEntrega): void { vehicleRepository.setLastApp(app); },
};

export type { Vehicle, AppEntrega };
