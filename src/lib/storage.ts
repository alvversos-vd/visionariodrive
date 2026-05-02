import { DailyEntry, DailyGoal, Goals, DEFAULT_GOALS, AppSettings, DEFAULT_SETTINGS, RideEntry } from './types';

const ENTRIES_KEY = 'lucro-delivery-entries';
const RIDES_KEY = 'lucro-delivery-rides';
const GOAL_KEY = 'lucro-delivery-goal'; // legacy single daily goal
const GOALS_KEY = 'lucro-delivery-goals';
const SETTINGS_KEY = 'lucro-delivery-settings';
const VEHICLES_KEY = 'lucro-delivery-vehicles';
const RIDE_TYPES_KEY = 'lucro-delivery-ride-types';

export function saveEntry(entry: DailyEntry): void {
  const entries = getEntries();
  entries.unshift(entry);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function getEntries(): DailyEntry[] {
  const raw = localStorage.getItem(ENTRIES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function deleteEntry(id: string): void {
  const entries = getEntries().filter(e => e.id !== id);
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

// Legacy single-goal API (kept for ResultsView/GoalSetting compatibility)
export function getGoal(): DailyGoal | null {
  const goals = getGoals();
  if (goals.daily > 0) return { amount: goals.daily };
  const raw = localStorage.getItem(GOAL_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveGoal(goal: DailyGoal): void {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
  const current = getGoals();
  saveGoals({ ...current, daily: goal.amount });
}

// New multi-goal API
export function getGoals(): Goals {
  const raw = localStorage.getItem(GOALS_KEY);
  if (raw) return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  // Migrate from legacy if present
  const legacy = localStorage.getItem(GOAL_KEY);
  if (legacy) {
    const g = JSON.parse(legacy);
    return { ...DEFAULT_GOALS, daily: g.amount || 0 };
  }
  return { ...DEFAULT_GOALS };
}

export function saveGoals(goals: Goals): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

// Settings
export function getSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resetAllData(): void {
  localStorage.removeItem(ENTRIES_KEY);
  localStorage.removeItem(RIDES_KEY);
  localStorage.removeItem(GOAL_KEY);
  localStorage.removeItem(GOALS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(VEHICLES_KEY);
  localStorage.removeItem(RIDE_TYPES_KEY);
}

// --- Ride entries (Análise de Corrida) ---
export function getRides(): RideEntry[] {
  const raw = localStorage.getItem(RIDES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRide(ride: RideEntry): void {
  const rides = getRides();
  rides.unshift(ride);
  localStorage.setItem(RIDES_KEY, JSON.stringify(rides));
}

export function deleteRide(id: string): void {
  const rides = getRides().filter(r => r.id !== id);
  localStorage.setItem(RIDES_KEY, JSON.stringify(rides));
}

// --- Vehicles & Ride Types (cadastro livre) ---
export function getVehicles(): string[] {
  const raw = localStorage.getItem(VEHICLES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveVehicles(list: string[]): void {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(list));
}

export function getRideTypes(): string[] {
  const raw = localStorage.getItem(RIDE_TYPES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRideTypes(list: string[]): void {
  localStorage.setItem(RIDE_TYPES_KEY, JSON.stringify(list));
}

