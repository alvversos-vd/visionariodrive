/**
 * SettingsRepository — owner físico das configurações do app.
 */

import { getSettings as legacyGetSettings, saveSettings as legacySaveSettings } from '../storage';
import type { AppSettings } from '../types';

export const settingsRepository = {
  get(): AppSettings { return legacyGetSettings(); },
  save(settings: AppSettings): void { legacySaveSettings(settings); },
};

export type { AppSettings };
