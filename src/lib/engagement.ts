// Lightweight local state for engagement micro-features (per device).

const K_LAST_OPEN = 'vd_last_open_date';
const K_FIRST_PROFIT = 'vd_first_profit_celebrated';
const K_RIDES5 = 'vd_rides5_celebrated';
const K_LAST_AVOID_AT = 'vd_last_avoid_at';
const K_FOCUS = 'vd_focus_mode';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getLastOpenDate(): string | null {
  return localStorage.getItem(K_LAST_OPEN);
}
export function markOpenedToday() {
  localStorage.setItem(K_LAST_OPEN, todayStr());
}
export function daysSinceLastOpen(): number | null {
  const last = getLastOpenDate();
  if (!last) return null;
  const a = new Date(last + 'T00:00:00').getTime();
  const b = new Date(todayStr() + 'T00:00:00').getTime();
  return Math.round((b - a) / 86400000);
}

export function shouldCelebrateFirstProfit(): boolean {
  return localStorage.getItem(K_FIRST_PROFIT) !== '1';
}
export function markFirstProfitCelebrated() {
  localStorage.setItem(K_FIRST_PROFIT, '1');
}

export function shouldCelebrateRides5(): boolean {
  return localStorage.getItem(K_RIDES5) !== '1';
}
export function markRides5Celebrated() {
  localStorage.setItem(K_RIDES5, '1');
}

export function getLastAvoidAt(): number {
  const v = localStorage.getItem(K_LAST_AVOID_AT);
  return v ? Number(v) : 0;
}
export function markAvoidNow() {
  localStorage.setItem(K_LAST_AVOID_AT, String(Date.now()));
}

export function getFocusMode(): boolean {
  return localStorage.getItem(K_FOCUS) === '1';
}
export function setFocusMode(on: boolean) {
  localStorage.setItem(K_FOCUS, on ? '1' : '0');
}
