/**
 * VehicleRepository — owner físico de veículos e app ativo.
 *
 * Delega para `lib/vehicles.ts` (fonte legacy). Fase 2 absorve os bytes.
 */

import {
  getVehiclesV2,
  addVehicle as legacyAdd,
  updateVehicle as legacyUpdate,
  deleteVehicle as legacyDelete,
  getActiveVehicleId,
  setActiveVehicleId,
  getActiveVehicle,
  getVehicleById,
  getLastApp,
  setLastApp,
  hasAnyVehicle,
  vehicleCostPerKm,
  type Vehicle,
  type AppEntrega,
} from '../vehicles';

export const vehicleRepository = {
  list(): Vehicle[] { return getVehiclesV2(); },
  add: legacyAdd,
  update: legacyUpdate,
  remove: legacyDelete,
  getById: getVehicleById,
  getActive: getActiveVehicle,
  getActiveId: getActiveVehicleId,
  setActiveId: setActiveVehicleId,
  hasAny: hasAnyVehicle,
  costPerKm: vehicleCostPerKm,
  getLastApp,
  setLastApp,
};

export type { Vehicle, AppEntrega };
