/**
 * Base repository utilities.
 *
 * Repositories são a ÚNICA camada que fala com localStorage/cloudSync/Supabase.
 * Nenhum componente React e nenhum arquivo fora de `src/lib/repositories/` deve
 * importar deste módulo diretamente — use Services.
 *
 * Convenções:
 *  - Leitura: `readJson<T>(key, fallback)` faz parse defensivo.
 *  - Escrita: `writeJson(key, value, { markCloud })` persiste + notifica sync.
 *  - Persistência versionada: `readVersioned<T>(key, currentVersion, migrator)`.
 *
 * Motivo de sobreviver na base do `localStorage` diretamente: nesta sprint
 * (1.5) os módulos Shift/GPS ainda leem `storage.ts` legacy — para não tocar
 * neles, os repositórios que compartilham chaves com Shift (ride/goals/…)
 * também consomem `storage.ts` como fonte física de bytes. Na Fase 2, quando
 * Shift migrar, `storage.ts` desaparece e a leitura física passa a viver aqui.
 */

import { markDirty } from '../cloudSync';

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(
  key: string,
  value: unknown,
  opts: { markCloud?: boolean; immediate?: boolean } = {},
): void {
  localStorage.setItem(key, JSON.stringify(value));
  if (opts.markCloud !== false) markDirty({ immediate: opts.immediate });
}

export interface VersionedPayload<T> {
  schemaVersion: number;
  data: T;
}

export function readVersioned<T>(
  key: string,
  currentVersion: number,
  migrate: (raw: unknown, version: number) => T,
  empty: () => T,
): VersionedPayload<T> {
  const raw = localStorage.getItem(key);
  if (!raw) return { schemaVersion: currentVersion, data: empty() };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed) {
      const version = Number((parsed as { schemaVersion: unknown }).schemaVersion);
      if (version === currentVersion) {
        return parsed as VersionedPayload<T>;
      }
      const data = migrate(parsed, version);
      return { schemaVersion: currentVersion, data };
    }
    // legacy (não-versionado) → deixa o migrator normalizar
    const data = migrate(parsed, 0);
    return { schemaVersion: currentVersion, data };
  } catch {
    return { schemaVersion: currentVersion, data: empty() };
  }
}
