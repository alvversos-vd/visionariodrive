import { DailyEntry, DailyGoal } from './types';

const ENTRIES_KEY = 'lucro-delivery-entries';
const GOAL_KEY = 'lucro-delivery-goal';

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

export function getGoal(): DailyGoal | null {
  const raw = localStorage.getItem(GOAL_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveGoal(goal: DailyGoal): void {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}
