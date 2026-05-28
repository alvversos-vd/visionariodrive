/**
 * Tombstones: registro de entidades apagadas localmente que NUNCA devem
 * ressurgir via hidratação cloud ou realtime de outros dispositivos com
 * payload desatualizado.
 *
 * Persistido em localStorage (single-source-of-truth no device que apagou).
 * Não é sincronizado para o cloud — o push imediato após delete já garante
 * que o cloud reflita o estado correto na maioria dos cenários.
 */

const KEY = 'lucro-delivery-tombstones';

export interface Tombstones {
  entries: string[]; // ids de DailyEntry apagados
  shifts: string[];  // turno_ids apagados
}

const EMPTY: Tombstones = { entries: [], shifts: [] };

export function getTombstones(): Tombstones {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { ...EMPTY };
  try {
    const t = JSON.parse(raw);
    return {
      entries: Array.isArray(t.entries) ? t.entries : [],
      shifts: Array.isArray(t.shifts) ? t.shifts : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function save(t: Tombstones) {
  localStorage.setItem(KEY, JSON.stringify(t));
}

export function tombstoneEntry(id: string) {
  const t = getTombstones();
  if (!t.entries.includes(id)) {
    t.entries.push(id);
    save(t);
  }
}

export function tombstoneShift(turno_id: string) {
  const t = getTombstones();
  if (!t.shifts.includes(turno_id)) {
    t.shifts.push(turno_id);
    save(t);
  }
}

export function clearTombstones() {
  localStorage.removeItem(KEY);
}

/** Helper genérico (exportado também via cloudSync). */
export function filterByTombstones<T extends { id?: string; turno_id?: string; shiftId?: string }>(
  list: T[],
): T[] {
  const t = getTombstones();
  return list.filter(item => {
    if (item.id && t.entries.includes(item.id)) return false;
    if (item.turno_id && t.shifts.includes(item.turno_id)) return false;
    if (item.shiftId && t.shifts.includes(item.shiftId)) return false;
    return true;
  });
}

export const TOMBSTONES_KEY = KEY;
