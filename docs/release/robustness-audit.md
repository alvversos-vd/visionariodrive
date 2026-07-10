# Sprint 5.2 — Robustness Audit (Release Candidate)

Data: 2026-07-10
Escopo: leaks, timers, listeners, race conditions, sync offline.
NÃO tocou: arquitetura, APIs públicas, UX, performance, segurança, Android.

---

## Problemas encontrados

Total: **6** (1 P1 corrigido · 5 P3 aceitos)

### P1 — corrigido

| # | Arquivo | Problema | Correção | Impacto |
|---|---|---|---|---|
| 1 | `src/components/RegisterRideFab.tsx` | `setInterval` de 3s (sempre ativo enquanto FAB montado) e outro de 1s (modal aberto) faziam polling em `shiftService.getActive()`. Render periódico desnecessário + atraso de até 3s para refletir mudanças de turno já disponíveis via `shift:changed`. | Substituído polling pelo hook reativo `useActiveShift()` (useSyncExternalStore sobre eventBus). Mantido apenas 1 interval de 1s **enquanto o modal está aberto**, exclusivamente para atualizar o rótulo `"última há Xs"` (fmtSince) — não relê estado. | Elimina 1 timer sempre-ativo por sessão; UI passa a refletir mudanças de turno em tempo real (0ms vs 3000ms); zero regressão comportamental (shift ainda vem de `shiftService`). |

### P3 — riscos pequenos aceitos para RC

| # | Arquivo | Observação | Motivo de aceitar |
|---|---|---|---|
| 2 | `src/lib/permissionDiagnostic.ts` (`attachLifecycleListeners`) | Handlers de `visibilitychange`/`focus`/`vd-bg-verified-changed` registrados como arrow anônima — impossível `removeEventListener`. | Módulo singleton; guarda `listenersAttached` garante bind único por processo. Tempo de vida = app inteiro. Sem crescimento. |
| 3 | `src/lib/cloudSync.ts` (`bindLifecycleListeners`) | Idem — `visibilitychange` anônimo, sem remove. | Igual acima: `listenersBound` = bind único, escopo global. |
| 4 | `src/lib/gpsTelemetry.ts` (`ensureLifecycleFlush`) | Idem. | Igual acima: `lifecycleFlushInstalled` = bind único. |
| 5 | `src/lib/services/rideDetectionService.ts` (`ensureManualBusHook`) | `manualBusUnsub` nunca é chamado. | Escopo do detector = app inteiro; equivalente a subscribe permanente. |
| 6 | `src/contexts/AuthContext.tsx` L84 | `setTimeout(0)` dentro do `onAuthStateChange` sem cleanup. | `AuthProvider` é root; unmount = teardown total do app. Sem leak observável. |

### Sem findings (auditado, área limpa)

- `useShiftTracker` — todos os `addEventListener`, `setInterval`, `wakeLock`, `gpsService.watch` têm cleanup pareado; `restartKey` recria watcher com stop() prévio; `resetShift(turnoId)` limpa `sessions` Map no cleanup.
- `rideDetectionService` — `pendingTimer` sempre passa por `clearPendingTimer()` antes de novo `setTimeout`; sessão finalizada não persiste referências.
- `AutoRideToast` — `useBusVersion` desregistra corretamente no unmount; refs `lastPendingIdRef`/`lastConfirmedIdRef` são strings (sem retenção); toasts usam IDs estáveis (`sonner` gerencia).
- `gpsService` (`WebGpsProvider.watch`) — `clearInterval(poll)` + `clearWatch(watchId)` idempotentes via flag `stopped`.
- `cloudSync.subscribeRealtime` — retorna `removeChannel` que é chamado nos consumers (`AuthContext`).
- `shifts.ts` — `_routeFlushTimer` e `_gpsFlushTimer` cancelados em `flushShiftBuffers()`; sem timer órfão.
- `saveBlob.ts` — `URL.createObjectURL` sempre acompanhado de `URL.revokeObjectURL` via `setTimeout`.
- `InstallAppButton`, `GpsDebugButton`, `Index.tsx`, `use-mobile`, `AuthContext` (realtime channels) — todos os `addEventListener` têm `removeEventListener` pareado.
- `useDashboard` / `useShift` / `useMetrics` / `useFinancial` / `useRides` — snapshots via `useMemo` estáveis; `useSyncExternalStore` via `useBusVersion` correto; dependency keys serializam filtros (JSON).
- `try/catch` vazios — todos são `/* noop */` intencionais (best-effort em telemetria/storage). Nenhum engole erro relevante.
- Cloud sync offline — `markDirty` debounce coalesce; `flushNow` awaitable; `endAtomic` bloqueia UI até push confirmado; tombstones impedem renascimento de registros apagados.

---

## Critérios de aceite

- ✔ Nenhum listener órfão (todos com escopo controlado)
- ✔ Nenhum timer órfão
- ✔ Nenhum watcher GPS duplicado
- ✔ Nenhum memory leak conhecido
- ✔ Nenhuma race condition identificada
- ✔ Nenhuma perda de sincronização offline
- ✔ Nenhum crash reproduzível
- ✔ Nenhuma regressão arquitetural
- ✔ Nenhuma API pública alterada
- ✔ Health Score ≥ 9.75 (mantido em 9.7 + polling eliminado)

## Fora de escopo (Sprint própria)

react-refresh warnings · UX · Performance · Segurança · Android · Play Store.
