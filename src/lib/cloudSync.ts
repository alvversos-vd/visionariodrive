import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Keys mapped to columns
const KEY_MAP = {
  'lucro-delivery-entries': 'entries',
  'lucro-delivery-rides': 'rides',
  'lucro-delivery-goals': 'goals',
  'lucro-delivery-settings': 'settings',
  'lucro-delivery-vehicles': 'vehicles',
  'lucro-delivery-ride-types': 'ride_types',
  'lucro-delivery-expenses': 'expenses',
} as const;

type LocalKey = keyof typeof KEY_MAP;
const LOCAL_KEYS = Object.keys(KEY_MAP) as LocalKey[];

let currentUserId: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let hydrating = false;

export function setSyncUser(userId: string | null) {
  currentUserId = userId;
}

function readLocal(key: LocalKey): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) {
    if (key === 'lucro-delivery-goals') return { daily: 0, weekly: 0, monthly: 0 };
    if (key === 'lucro-delivery-settings')
      return { profitMargin: 1.3, currency: 'BRL', estimatedHours: 8 };
    if (key === 'lucro-delivery-vehicles' || key === 'lucro-delivery-ride-types') return [];
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
      // Primeira vez: criar registro com dados locais (caso existam)
      const payload: Record<string, unknown> = { user_id: userId };
      for (const lk of LOCAL_KEYS) payload[KEY_MAP[lk]] = readLocal(lk);
      await supabase.from('user_data').insert(payload as never);
    } else {
      for (const lk of LOCAL_KEYS) {
        const col = KEY_MAP[lk];
        const value = (data as Record<string, unknown>)[col];
        if (value !== undefined && value !== null) {
          localStorage.setItem(lk, JSON.stringify(value));
        }
      }
      window.dispatchEvent(new CustomEvent('cloud-hydrated'));
    }
  } finally {
    hydrating = false;
  }
}

export function markDirty() {
  if (!currentUserId || hydrating) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void pushToCloud(), 600);
}

async function pushToCloud() {
  if (!currentUserId) return;
  const payload: Record<string, unknown> = { user_id: currentUserId };
  for (const lk of LOCAL_KEYS) payload[KEY_MAP[lk]] = readLocal(lk);

  const { error } = await supabase
    .from('user_data')
    .upsert(payload as never, { onConflict: 'user_id' });

  if (!error) {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast({ description: '✓ Salvo automaticamente', duration: 1500 });
    }, 200);
  }
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
              localStorage.setItem(lk, JSON.stringify(value));
            }
          }
        } finally {
          hydrating = false;
        }
        onChange();
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function clearLocalCache() {
  for (const lk of LOCAL_KEYS) localStorage.removeItem(lk);
}
