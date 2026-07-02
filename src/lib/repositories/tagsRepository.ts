/**
 * TagsRepository — owner físico das listas auxiliares:
 *   - tags de veículo (labels usadas em selects de calculadora legada)
 *   - tipos de corrida (labels)
 *   - categorias auxiliares (futuro)
 *
 * Isolado do SettingsRepository para preservar Single Responsibility:
 *   SettingsRepository → configurações comportamentais (margem, alertas…)
 *   TagsRepository     → listas de rótulos exibidos em UI
 *
 * Nesta sprint delega para `storage.ts` porque os bytes ainda vivem lá
 * (compat com hidratação atual do cloudSync). Fase 2 absorve.
 */

import {
  getVehicles as legacyGetVehicles,
  saveVehicles as legacySaveVehicles,
  getRideTypes as legacyGetRideTypes,
  saveRideTypes as legacySaveRideTypes,
} from '../storage';

export const tagsRepository = {
  listVehicleTags(): string[] { return legacyGetVehicles(); },
  saveVehicleTags(list: string[]): void { legacySaveVehicles(list); },

  listRideTypeTags(): string[] { return legacyGetRideTypes(); },
  saveRideTypeTags(list: string[]): void { legacySaveRideTypes(list); },
};
