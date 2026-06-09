/**
 * BUG-MVP-004/005 — Telemetria de exportações (PDF/GPX/KML).
 *
 * Objetivo: distinguir, com evidência de campo, qual caminho de entrega
 * (Web Share / Anchor / Window Open) realmente funciona em cada ambiente:
 *
 *   - Browser desktop
 *   - PWA instalado
 *   - Capacitor Android (APK / WebView)
 *
 * 100% passivo: não altera o comportamento de saveBlob nem dos exporters.
 * Apenas registra eventos em um ring buffer e expõe um snapshot exportável.
 */

import { Capacitor } from '@capacitor/core';

export type ExportType = 'pdf' | 'gpx' | 'kml' | 'diag-json' | 'other';
export type ExportPath = 'native-share' | 'web-share' | 'anchor-download' | 'window-open' | 'failed';
export type ExportOutcome = 'resolved' | 'rejected' | 'aborted' | 'unknown';

export type ExportEvent =
  | { t: number; kind: 'attempt'; type: ExportType; sizeBytes: number; mime: string; filename: string }
  | { t: number; kind: 'capability_probe'; canShare: boolean; canShareFiles: boolean; isSecureContext: boolean; hasDownloadAttr: boolean }
  | { t: number; kind: 'path_tried'; path: ExportPath; reasonChosen: string }
  | { t: number; kind: 'path_result'; path: ExportPath; outcome: ExportOutcome; durationMs: number; errorMessage?: string }
  | { t: number; kind: 'final_outcome'; path: ExportPath; delivered: 'confirmed' | 'assumed' | 'failed' }
  | { t: number; kind: 'step'; scope: string; step: string; data?: Record<string, unknown> }
  | { t: number; kind: 'error'; scope: string; step: string; message: string; stack?: string };

const MAX_EVENTS = 500;
const buf: ExportEvent[] = [];

function push(ev: ExportEvent) {
  buf.push(ev);
  if (buf.length > MAX_EVENTS) buf.shift();
  // Log estruturado para captura em remote/adb logcat
  // eslint-disable-next-line no-console
  console.info('[exportTelemetry]', ev);
}

export const exportTelemetry = {
  attempt(type: ExportType, blob: Blob, filename: string) {
    push({
      t: Date.now(),
      kind: 'attempt',
      type,
      sizeBytes: blob.size,
      mime: blob.type || 'application/octet-stream',
      filename,
    });
  },
  capability(probe: Omit<Extract<ExportEvent, { kind: 'capability_probe' }>, 't' | 'kind'>) {
    push({ t: Date.now(), kind: 'capability_probe', ...probe });
  },
  pathTried(path: ExportPath, reasonChosen: string) {
    push({ t: Date.now(), kind: 'path_tried', path, reasonChosen });
  },
  pathResult(path: ExportPath, outcome: ExportOutcome, durationMs: number, errorMessage?: string) {
    push({ t: Date.now(), kind: 'path_result', path, outcome, durationMs, errorMessage });
  },
  finalOutcome(path: ExportPath, delivered: 'confirmed' | 'assumed' | 'failed') {
    push({ t: Date.now(), kind: 'final_outcome', path, delivered });
  },
  snapshot() {
    let isNative = false;
    let platform = 'unknown';
    try {
      isNative = Capacitor.isNativePlatform();
      platform = Capacitor.getPlatform();
    } catch {
      /* noop */
    }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const standalone =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        // iOS Safari
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true);
    return {
      generatedAt: new Date().toISOString(),
      env: {
        isCapacitorNative: isNative,
        platform,
        userAgent: ua,
        isPwaStandalone: !!standalone,
        isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
      },
      events: buf.slice(),
    };
  },
  clear() {
    buf.length = 0;
  },
};

export type ExportTelemetrySnapshot = ReturnType<typeof exportTelemetry.snapshot>;
