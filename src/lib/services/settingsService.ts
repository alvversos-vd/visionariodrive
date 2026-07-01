/**
 * SettingsService — única API para AppSettings + listas auxiliares
 * (veículos legacy string, tipos de corrida). Consome settingsRepository.
 */

import { settingsRepository, type AppSettings } from '../repositories/settingsRepository';
import {
  getVehicles as legacyGetVehicles,
  saveVehicles as legacySaveVehicles,
  getRideTypes as legacyGetRideTypes,
  saveRideTypes as legacySaveRideTypes,
  clearAllAppData as legacyClearAll,
} from '../storage';

export const settingsService = {
  get(): AppSettings { return settingsRepository.get(); },
  save(settings: AppSettings): void { settingsRepository.save(settings); },
  update(patch: Partial<AppSettings>): AppSettings {
    const current = settingsRepository.get();
    const next = { ...current, ...patch };
    settingsRepository.save(next);
    return next;
  },

  // Listas auxiliares (tags de veículo/tipo de corrida usadas em selects)
  getVehicleTags(): string[] { return legacyGetVehicles(); },
  saveVehicleTags(list: string[]): void { legacySaveVehicles(list); },
  getRideTypeTags(): string[] { return legacyGetRideTypes(); },
  saveRideTypeTags(list: string[]): void { legacySaveRideTypes(list); },

  /** Reset destrutivo total — usado apenas na tela de perfil/configurações. */
  resetAllData(): void { legacyClearAll(); },
};

export type { AppSettings };
