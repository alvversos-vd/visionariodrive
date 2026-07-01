/**
 * SettingsService — única API para AppSettings. Consome settingsRepository.
 */

import { settingsRepository, type AppSettings } from '../repositories/settingsRepository';

export const settingsService = {
  get(): AppSettings { return settingsRepository.get(); },
  save(settings: AppSettings): void { settingsRepository.save(settings); },
  update(patch: Partial<AppSettings>): AppSettings {
    const current = settingsRepository.get();
    const next = { ...current, ...patch };
    settingsRepository.save(next);
    return next;
  },
};

export type { AppSettings };
