import { supabase } from '@/integrations/supabase/client';
import { getTombstones, filterByTombstones } from './tombstones';

// Keys mapped to columns
const KEY_MAP = {
  'lucro-delivery-entries': 'entries',
  'lucro-delivery-rides': 'rides',
  'lucro-delivery-goals': 'goals',
  'lucro-delivery-settings': 'settings',
  'lucro-delivery-vehicles': 'vehicles',
  'lucro-delivery-ride-types': 'ride_types',
  'lucro-delivery-expenses': 'expenses',
  'lucro-delivery-shifts': 'shifts',
  'lucro-delivery-vehicles-v2': 'vehicles_v2',
  // Financeiro canônico (Fase 1): payload versionado { schemaVersion, entries }.
  // `expenses` permanece como espelho legacy para compat com clientes antigos.
  'vd-financial': 'financial',
  // Rides unificado (Fase 2.1): payload versionado { schemaVersion, rides:RideModel[] }.
  // `rides` (legacy RideEntry) e `shifts` seguem existindo como espelho legacy.
  'vd-rides': 'rides_v2',
} as const;

type LocalKey = keyof typeof KEY_MAP;
const LOCAL_KEYS = Object.keys(KEY_MAP) as LocalKey[];

let currentUserId: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hydrating = false;
let listenersBound = false;

export function setSyncUser(userId: string | null) {
  currentUserId = userId;
  if (userId && !listenersBound) bindLifecycleListeners();
}

function readLocal(key: LocalKey): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) {
    if (key === 'lucro-delivery-goals') return { daily: 0, weekly: 0, monthly: 0 };
    if (key === 'lucro-delivery-settings')
      return { profitMargin: 1.3, currency: 'BRL', estimatedHours: 8 };
    if (key === 'vd-financial') return { schemaVersion: 1, entries: [] };
    if (key === 'vd-rides') return { schemaVersion: 1, rides: [] };
    return [];
  }
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Aplica regras de merge defensivo na hidratação/realtime:
 *  - Filtra tombstones (entries/shifts apagados localmente nunca renascem).
 *  - Nunca rebaixa um shift que já está finalizado localmente para ativo/pausado.
 *  - Fase 2.4: strip completo do campo legacy `rides` em qualquer shift
 *    vindo do cloud — Shift.rides não é mais fonte de verdade.
 */
function stripLegacyRides<T>(s: T): T {
  if (s && typeof s === 'object' && 'rides' in (s as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { rides: _drop, ...rest } = s as any;
    return rest as T;
  }
  return s;
}

function mergeIncomingForKey(key: LocalKey, incoming: unknown): unknown {
  const tomb = getTombstones();

  if (key === 'lucro-delivery-shifts' && Array.isArray(incoming)) {
    const localRaw = localStorage.getItem(key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const local: any[] = localRaw ? (JSON.parse(localRaw) || []) : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const localById = new Map<string, any>(local.map((s: any) => [s.turno_id, s]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = (incoming as any[])
      .filter(s => !tomb.shifts.includes(s.turno_id))
      .map(s => {
        const l = localById.get(s.turno_id);
        // proteção crítica: não rebaixa um turno já finalizado localmente
        if (l && l.status === 'finalizado' && s.status !== 'finalizado') return stripLegacyRides(l);
        return stripLegacyRides(s);
      });
    // mantém turnos locais que ainda não chegaram do cloud (push em voo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    local.forEach((l: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!merged.find((m: any) => m.turno_id === l.turno_id) && !tomb.shifts.includes(l.turno_id)) {
        merged.unshift(stripLegacyRides(l));
      }
    });
    return merged;
  }

  if (key === 'lucro-delivery-entries' && Array.isArray(incoming)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (incoming as any[]).filter(
      e => !tomb.entries.includes(e.id) && !(e.shiftId && tomb.shifts.includes(e.shiftId))
    );
  }

  return incoming;
}

export async function hydrateFromCloud(userId: string) {
  hydrating = true;
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      const payload: Record<string, unknown> = { user_id: userId };
      for (const lk of LOCAL_KEYS) payload[KEY_MAP[lk]] = readLocal(lk);
      await supabase.from('user_data').insert(payload as never);
    } else {
      for (const lk of LOCAL_KEYS) {
        const col = KEY_MAP[lk];
        const value = (data as Record<string, unknown>)[col];
        if (value !== undefined && value !== null) {
          const merged = mergeIncomingForKey(lk, value);
          localStorage.setItem(lk, JSON.stringify(merged));
        }
      }
      window.dispatchEvent(new CustomEvent('cloud-hydrated'));
    }
  } finally {
    hydrating = false;
  }
}

/**
 * Marca dados como sujos. Por padrão usa debounce de 600ms.
 * Use { immediate: true } para operações críticas (endShift, deleteEntry,
 * deleteShift, clearAllAppData) onde a app pode ser minimizada logo após.
 * Retorna a Promise do push quando immediate=true, para callers que precisam
 * aguardar a confirmação antes de mudar de tela / fechar dialog.
 */
export function markDirty(opts?: { immediate?: boolean }): Promise<void> | void {
  if (!currentUserId || hydrating) return;
  if (opts?.immediate) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    return pushToCloud();
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void pushToCloud(), 300);
}

/**
 * Flush explícito e awaitable. Usar antes de navegar para fora de uma tela
 * crítica (ex.: fechar dialog de "finalizar turno") para garantir que o
 * estado finalizado já está no cloud antes do usuário potencialmente
 * minimizar/fechar o app — protege contra "turno renasce ativo" no reload.
 */
export async function flushNow(): Promise<void> {
  if (!currentUserId || hydrating) return;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { await pushToCloud(); } catch { /* silencioso — fallback no próximo ciclo */ }
}

async function pushToCloud() {
  if (!currentUserId) return;
  const payload: Record<string, unknown> = { user_id: currentUserId };
  for (const lk of LOCAL_KEYS) {
    let v = readLocal(lk);
    v = mergeIncomingForKey(lk, v);
    payload[KEY_MAP[lk]] = v;
  }
  await supabase
    .from('user_data')
    .upsert(payload as never, { onConflict: 'user_id' });
}

/** Flush síncrono best-effort em eventos de ciclo de vida (mobile/PWA).
 *  P0: garante flush dos buffers do turno (GPS + rota) ANTES do push pro cloud,
 *  para não perder os últimos metros registrados antes de minimizar/suspender. */
function flushOnLifecycle() {
  if (!currentUserId || hydrating) return;
  // Flush dos buffers do turno primeiro (escreve no localStorage), depois pushToCloud lê.
  // Import dinâmico evita ciclo shifts <-> cloudSync.
  try {
    import('./shifts').then(m => {
      try { m.flushShiftBuffers(); } catch { /* noop */ }
    }).catch(() => { /* noop */ });
  } catch { /* noop */ }
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  void pushToCloud();
}


function bindLifecycleListeners() {
  if (typeof window === 'undefined') return;
  listenersBound = true;
  window.addEventListener('pagehide', flushOnLifecycle);
  window.addEventListener('beforeunload', flushOnLifecycle);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnLifecycle();
  });
}

export function subscribeRealtime(userId: string, onChange: () => void) {
  const channel = supabase
    .channel(`user-data-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_data', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown> | undefined;
        if (!row) return;
        hydrating = true;
        try {
          for (const lk of LOCAL_KEYS) {
            const col = KEY_MAP[lk];
            const value = row[col];
            if (value !== undefined && value !== null) {
              const merged = mergeIncomingForKey(lk, value);
              localStorage.setItem(lk, JSON.stringify(merged));
            }
          }
        } finally {
          hydrating = false;
        }
        onChange();
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function clearLocalCache() {
  for (const lk of LOCAL_KEYS) localStorage.removeItem(lk);
}

/** Expõe a lista de keys gerenciadas (útil para clearAllAppData). */
export function getManagedKeys(): LocalKey[] {
  return [...LOCAL_KEYS];
}

// Re-export para conveniência
export { filterByTombstones };
