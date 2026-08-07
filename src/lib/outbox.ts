/**
 * Outbox durável — Sprint 10.4.9 (blindagem do pipeline de persistência).
 *
 * PROBLEMA QUE RESOLVE
 * O `cloudSync` era fire-and-forget: se o push falhasse (offline, 5xx, app
 * morto pelo SO logo após o registro), a intenção de sincronizar se perdia.
 * A corrida continuava no device, mas o cloud ficava atrasado — e uma
 * hidratação posterior podia sobrescrever o estado local.
 *
 * O QUE É
 * Fila durável de UMA intenção ("estado local está sujo"), persistida em
 * localStorage. Sync é **state-based** (o payload é sempre o estado atual
 * completo), então uma flag durável + retry é semanticamente equivalente a
 * uma fila de operações — sem risco de reordenação ou reaplicação dupla.
 *
 * GARANTIAS
 *  - Nenhuma escrita local depende do resultado do push (nunca bloqueia UX).
 *  - `dirtySince` sobrevive a kill do processo → retry no próximo boot.
 *  - Retry com backoff exponencial + gatilhos `online` / `visibilitychange`.
 *  - Idempotente: o push envia sempre o snapshot atual (upsert por user_id).
 *  - Zero regra de negócio aqui — é infraestrutura (ADR-005).
 */

import { eventBus } from './eventBus';

const KEY = 'vd-outbox';
const BACKOFF_MS = [1_000, 3_000, 8_000, 20_000, 60_000, 120_000];
const DEBOUNCE_MS = 300;

export type OutboxStatus = 'idle' | 'pending' | 'syncing' | 'error';

export interface OutboxState {
  /** epoch ms da primeira escrita não sincronizada; null = tudo sincronizado */
  dirtySince: number | null;
  attempts: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

const EMPTY: OutboxState = { dirtySince: null, attempts: 0, lastSyncAt: null, lastError: null };

function read(): OutboxState {
  if (typeof localStorage === 'undefined') return { ...EMPTY };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw);
    return {
      dirtySince: typeof p.dirtySince === 'number' ? p.dirtySince : null,
      attempts: typeof p.attempts === 'number' ? p.attempts : 0,
      lastSyncAt: typeof p.lastSyncAt === 'number' ? p.lastSyncAt : null,
      lastError: typeof p.lastError === 'string' ? p.lastError : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(state: OutboxState): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
}

class Outbox {
  private pushFn: (() => Promise<void>) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private bound = false;
  private status: OutboxStatus = 'idle';

  /** Registrado uma única vez pelo cloudSync (dono do transporte). */
  configure(pushFn: () => Promise<void>): void {
    this.pushFn = pushFn;
    this.bindListeners();
    // Boot: se ficou sujo de uma sessão anterior, tenta imediatamente.
    if (read().dirtySince !== null) this.schedule(0);
  }

  /** Suspende o outbox (logout / troca de usuário). */
  reset(): void {
    this.pushFn = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    write({ ...EMPTY });
    this.setStatus('idle');
  }

  getState(): OutboxState { return read(); }
  getStatus(): OutboxStatus { return this.status; }
  isPending(): boolean { return read().dirtySince !== null; }

  /** Marca o estado local como sujo. Nunca lança, nunca bloqueia. */
  markDirty(opts: { immediate?: boolean } = {}): Promise<void> | void {
    const state = read();
    if (state.dirtySince === null) {
      write({ ...state, dirtySince: Date.now(), attempts: 0, lastError: null });
    }
    this.setStatus('pending');
    if (opts.immediate) return this.flush();
    this.schedule(DEBOUNCE_MS);
  }

  /** Tentativa explícita e awaitable. Erros são absorvidos (ficam na fila). */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.inFlight) return this.inFlight;
    if (!this.pushFn) return;
    if (read().dirtySince === null) return;

    const run = (async () => {
      const before = Date.now();
      this.setStatus('syncing');
      try {
        await this.pushFn!();
        const state = read();
        // Escritas que chegaram DURANTE o push mantêm a fila suja.
        const stillDirty = state.dirtySince !== null && state.dirtySince > before;
        write({
          dirtySince: stillDirty ? state.dirtySince : null,
          attempts: 0,
          lastSyncAt: Date.now(),
          lastError: null,
        });
        this.setStatus(stillDirty ? 'pending' : 'idle');
        if (stillDirty) this.schedule(DEBOUNCE_MS);
      } catch (err) {
        const state = read();
        const attempts = state.attempts + 1;
        write({
          ...state,
          dirtySince: state.dirtySince ?? before,
          attempts,
          lastError: err instanceof Error ? err.message : 'sync_failed',
        });
        this.setStatus('error');
        this.schedule(BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]);
      }
    })();

    this.inFlight = run.finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private schedule(delay: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, delay);
  }

  private setStatus(next: OutboxStatus): void {
    if (this.status === next) return;
    this.status = next;
    try { eventBus.emit('sync:changed'); } catch { /* noop */ }
  }

  private bindListeners(): void {
    if (this.bound || typeof window === 'undefined') return;
    this.bound = true;
    window.addEventListener('online', () => { void this.flush(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isPending()) void this.flush();
    });
  }
}

export const outbox = new Outbox();
export const OUTBOX_KEY = KEY;
