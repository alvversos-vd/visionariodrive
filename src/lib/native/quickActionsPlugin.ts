/**
 * quickActionsPlugin — Sprint 7 · Checkpoint 1.
 *
 * Wrapper Capacitor do plugin nativo `VisionarioQuickActions`.
 * Stub no-op em web/PWA para manter o pipeline TS agnóstico.
 * Nenhuma regra de negócio aqui — transporte puro.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type QuickActionType =
  | 'register'
  | 'finish'
  | 'confirm-auto'
  | 'edit-auto'
  | 'discard-auto'
  | 'undo';

export interface QuickActionEvent {
  type: QuickActionType;
  /** Texto digitado no RemoteInput do botão "Registrar corrida" (Sprint 10.4.8). */
  raw?: string;
  /** Chave de idempotência da ação nativa (Sprint 10.4.9), quando disponível. */
  requestId?: string;
  payload?: Record<string, unknown>;
}

export interface UpdateContentOptions {
  title?: string;
  content?: string;
}

export interface AutoRideCandidateOptions {
  valor?: number;
  app?: string;
  resumo?: string;
}

export interface UndoOptions {
  resumo?: string;
}

export interface QuickActionsPlugin {
  start(options?: UpdateContentOptions): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  updateContent(options: UpdateContentOptions): Promise<{ updated: boolean }>;
  showAutoRideCandidate(options: AutoRideCandidateOptions): Promise<void>;
  hideAutoRideCandidate(): Promise<void>;
  showUndo(options: UndoOptions): Promise<void>;
  hideUndo(): Promise<void>;
  /** Toast nativo curto — feedback sem abrir o app. */
  showToast(options: { message: string }): Promise<void>;
  addListener(
    eventName: 'action',
    listener: (event: QuickActionEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const noop = async () => undefined as never;

const webStub: QuickActionsPlugin = {
  start: async () => ({ started: false }),
  stop: async () => ({ stopped: false }),
  updateContent: async () => ({ updated: false }),
  showAutoRideCandidate: noop,
  hideAutoRideCandidate: noop,
  showUndo: noop,
  hideUndo: noop,
  showToast: noop,
  addListener: async () => ({ remove: async () => undefined }) as PluginListenerHandle,
};

const nativeAvailable = Capacitor.getPlatform() === 'android';

export const quickActionsPlugin: QuickActionsPlugin = nativeAvailable
  ? registerPlugin<QuickActionsPlugin>('VisionarioQuickActions', { web: webStub })
  : webStub;

export const isQuickActionsNative = nativeAvailable;
