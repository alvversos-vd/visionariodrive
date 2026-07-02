/**
 * SettingsService — única API para AppSettings + listas auxiliares
 * (tags de veículo, tipos de corrida).
 *
 * Sprint 1.6:
 *   - Removidas TODAS as importações diretas de `storage.ts`.
 *   - Tags saíram para `tagsRepository` (Single Responsibility).
 *   - Reset destrutivo saiu para `dataLifecycleService`.
 *
 * Consome APENAS: settingsRepository + tagsRepository.
 */

import { settingsRepository, type AppSettings } from '../repositories/settingsRepository';
import { tagsRepository } from '../repositories/tagsRepository';

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
  getVehicleTags(): string[] { return tagsRepository.listVehicleTags(); },
  saveVehicleTags(list: string[]): void { tagsRepository.saveVehicleTags(list); },
  getRideTypeTags(): string[] { return tagsRepository.listRideTypeTags(); },
  saveRideTypeTags(list: string[]): void { tagsRepository.saveRideTypeTags(list); },
};

export type { AppSettings };
