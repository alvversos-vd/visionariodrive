import { DailyEntry, DailyGoal, Goals, DEFAULT_GOALS, AppSettings, DEFAULT_SETTINGS, RideEntry } from './types';
import { markDirty } from './cloudSync';
import { tombstoneEntry, tombstoneShift, clearTombstones, TOMBSTONES_KEY } from './tombstones';

const ENTRIES_KEY = 'lucro-delivery-entries';
const RIDES_KEY = 'lucro-delivery-rides';
const GOAL_KEY = 'lucro-delivery-goal';
const GOALS_KEY = 'lucro-delivery-goals';
const SETTINGS_KEY = 'lucro-delivery-settings';
const VEHICLES_KEY = 'lucro-delivery-vehicles';
const RIDE_TYPES_KEY = 'lucro-delivery-ride-types';

/**
 * Registry único de TODAS as chaves localStorage usadas pelo app.
 * Fonte de verdade para clearAllAppData() — qualquer nova chave persistida
 * pelo app DEVE ser adicionada aqui para que o "Resetar dados" funcione.
 */
export const APP_STORAGE_KEYS: string[] = [
  // dados sincronizados via cloudSync
  ENTRIES_KEY,
  RIDES_KEY,
  GOAL_KEY,
  GOALS_KEY,
  SETTINGS_KEY,
  VEHICLES_KEY,
  RIDE_TYPES_KEY,
  'lucro-delivery-expenses',
  'vd-financial',
  'lucro-delivery-shifts',
  'lucro-delivery-vehicles-v2',
  // estado local não-sincronizado
  'lucro-delivery-vehicle-active',
  'lucro-delivery-last-app',
  'lucro-delivery-engagement',
  'lucro-delivery-fixed-costs-hint',
  'lucro-delivery-pwa-dismissed',
  'lucro-delivery-gps-consent',
  'vd-bg-gps-consent-v1',
  'vd-bg-always-verified-v1',
  'vd-permission-onboarding-v1',
  'vd-tracking-force-manual-v1',
  TOMBSTONES_KEY,
];

export function saveEntry(entry: DailyEntry): void {
  const entries = getEntries();
  entries.unshift(entry);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  markDirty({ immediate: true });
}

/**
 * Insere ou atualiza um entry de forma idempotente.
 */
export function upsertEntry(entry: DailyEntry): void {
  const entries = getEntries();
  const idx = entries.findIndex(e =>
    e.id === entry.id || (entry.shiftId && e.shiftId === entry.shiftId)
  );
  if (idx >= 0) entries[idx] = entry;
  else entries.unshift(entry);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  markDirty({ immediate: true });
}

export function getEntries(): DailyEntry[] {
  const raw = localStorage.getItem(ENTRIES_KEY);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Apaga um entry com tombstone (não ressurge via cloud) e cascateia
 * para o shift de origem quando aplicável (entries derivadas de turno).
 * Push imediato para o cloud para evitar race condition no mobile.
 */
export function deleteEntry(id: string): void {
  const all = getEntries();
  const target = all.find(e => e.id === id);
  const remaining = all.filter(e => e.id !== id);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(remaining));
  tombstoneEntry(id);

  // Cascade: se a entry veio de um turno (source: 'shift'), apaga o turno
  // de origem para evitar que o bridge a recrie na próxima finalização/hidratação.
  if (target?.shiftId) {
    try {
      // import dinâmico para evitar ciclo storage <-> shifts
      const SHIFTS_KEY = 'lucro-delivery-shifts';
      const raw = localStorage.getItem(SHIFTS_KEY);
      if (raw) {
        const shifts = JSON.parse(raw) as Array<{ turno_id: string }>;
        const next = shifts.filter(s => s.turno_id !== target.shiftId);
        if (next.length !== shifts.length) {
          localStorage.setItem(SHIFTS_KEY, JSON.stringify(next));
          tombstoneShift(target.shiftId);
        }
      }
    } catch { /* não-bloqueante */ }
  }

  markDirty({ immediate: true });
}

// Legacy single-goal API
export function getGoal(): DailyGoal | null {
  const goals = getGoals();
  if (goals.daily > 0) return { amount: goals.daily };
  const raw = localStorage.getItem(GOAL_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveGoal(goal: DailyGoal): void {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
  markDirty();
  const current = getGoals();
  saveGoals({ ...current, daily: goal.amount });
}

export function getGoals(): Goals {
  const raw = localStorage.getItem(GOALS_KEY);
  if (raw) return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  const legacy = localStorage.getItem(GOAL_KEY);
  if (legacy) {
    const g = JSON.parse(legacy);
    return { ...DEFAULT_GOALS, daily: g.amount || 0 };
  }
  return { ...DEFAULT_GOALS };
}

export function saveGoals(goals: Goals): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  markDirty();
}

export function getSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  markDirty();
}

/**
 * Reset total e definitivo: limpa TODAS as chaves do app (registry único),
 * limpa tombstones e empurra estado vazio para o cloud imediatamente.
 * Substitui o resetAllData() legado que limpava apenas 7 chaves.
 */
export function clearAllAppData(): void {
  for (const key of APP_STORAGE_KEYS) localStorage.removeItem(key);
  clearTombstones();
  // push imediato — o payload vai com tudo zerado, evitando ressurreição via hidratação
  markDirty({ immediate: true });
}

/** @deprecated Use clearAllAppData(). Mantido para compatibilidade de imports. */
export const resetAllData = clearAllAppData;

// --- Ride entries ---
export function getRides(): RideEntry[] {
  const raw = localStorage.getItem(RIDES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRide(ride: RideEntry): void {
  const rides = getRides();
  rides.unshift(ride);
  localStorage.setItem(RIDES_KEY, JSON.stringify(rides));
  markDirty({ immediate: true });
}

export function deleteRide(id: string): void {
  const rides = getRides().filter(r => r.id !== id);
  localStorage.setItem(RIDES_KEY, JSON.stringify(rides));
  markDirty();
}

// --- Vehicles & Ride Types ---
export function getVehicles(): string[] {
  const raw = localStorage.getItem(VEHICLES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveVehicles(list: string[]): void {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(list));
  markDirty();
}

export function getRideTypes(): string[] {
  const raw = localStorage.getItem(RIDE_TYPES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRideTypes(list: string[]): void {
  localStorage.setItem(RIDE_TYPES_KEY, JSON.stringify(list));
  markDirty();
}
