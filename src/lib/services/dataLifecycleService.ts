/**
 * DataLifecycleService — ÚNICA API destrutiva do app.
 *
 * Responsabilidade única (SRP):
 *   - `resetAll()`      → apaga TODO o estado local do app e sincroniza cloud.
 *   - `clearLocalCache()` → limpa apenas o cache local gerenciado pelo
 *                           cloudSync (usado em logout/troca de conta).
 *
 * Motivo de existir: antes desta sprint, `SettingsService` acumulava
 * responsabilidade destrutiva (resetAllData) e componentes chamavam
 * `cloudSync.clearLocalCache` diretamente — violando a arquitetura.
 * Agora toda operação de ciclo de vida de dados passa por aqui.
 *
 * Componentes React NÃO devem importar `storage.ts` nem `cloudSync.ts`
 * para essas operações. Use este serviço.
 */

import { clearAllAppData } from '../storage';
import { clearLocalCache as cloudClearLocalCache } from '../cloudSync';

export const dataLifecycleService = {
  /**
   * Reset destrutivo total: apaga TODAS as chaves do app (registry único),
   * limpa tombstones e empurra estado vazio para o cloud imediatamente.
   */
  resetAll(): void {
    clearAllAppData();
  },

  /**
   * Limpa apenas o cache local dos dados gerenciados pelo cloudSync.
   * Usado em fluxos de logout / troca de conta / delete-account — mantém
   * flags de dispositivo (consents, onboarding, etc.).
   */
  clearLocalCache(): void {
    cloudClearLocalCache();
  },
};

export type DataLifecycleService = typeof dataLifecycleService;
