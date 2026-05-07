// Lightweight local state for engagement micro-features (per device).

const K_LAST_OPEN = 'vd_last_open_date';
const K_FIRST_PROFIT = 'vd_first_profit_celebrated';
const K_RIDES5 = 'vd_rides5_celebrated';
const K_LAST_AVOID_AT = 'vd_last_avoid_at';
const K_FOCUS = 'vd_focus_mode';
const K_OPEN_COUNT = 'vd_open_count';
const K_RIDES_ANALYZED = 'vd_rides_analyzed';
const K_UPGRADE_DISMISSED_AT = 'vd_upgrade_dismissed_at';
const K_FIXED_COSTS_HINT = 'vd_fixed_costs_hint_shown';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function getLastOpenDate(): string | null {
  return localStorage.getItem(K_LAST_OPEN);
}
export function markOpenedToday() {
  const prev = localStorage.getItem(K_LAST_OPEN);
  const today = todayStr();
  if (prev !== today) {
    localStorage.setItem(K_LAST_OPEN, today);
    const c = Number(localStorage.getItem(K_OPEN_COUNT) || '0') + 1;
    localStorage.setItem(K_OPEN_COUNT, String(c));
  }
}
export function getOpenCount(): number {
  return Number(localStorage.getItem(K_OPEN_COUNT) || '0');
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

// PRO upgrade triggers
export function incrementRidesAnalyzed() {
  const c = Number(localStorage.getItem(K_RIDES_ANALYZED) || '0') + 1;
  localStorage.setItem(K_RIDES_ANALYZED, String(c));
}
export function getRidesAnalyzed(): number {
  return Number(localStorage.getItem(K_RIDES_ANALYZED) || '0');
}
export function dismissUpgrade() {
  localStorage.setItem(K_UPGRADE_DISMISSED_AT, String(Date.now()));
}
export function shouldShowUpgradePrompt(): boolean {
  // Mostrar quando: 2+ aberturas OU 3+ corridas analisadas, e não dispensado nas últimas 48h
  const opens = getOpenCount();
  const rides = getRidesAnalyzed();
  if (opens < 2 && rides < 3) return false;
  const dismissedAt = Number(localStorage.getItem(K_UPGRADE_DISMISSED_AT) || '0');
  if (dismissedAt && Date.now() - dismissedAt < 48 * 60 * 60 * 1000) return false;
  return true;
}

// Hint dos custos fixos (mostrar só 1x)
export function shouldShowFixedCostsHint(): boolean {
  return localStorage.getItem(K_FIXED_COSTS_HINT) !== '1';
}
export function markFixedCostsHintShown() {
  localStorage.setItem(K_FIXED_COSTS_HINT, '1');
}
