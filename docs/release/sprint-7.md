# Sprint 7 — Driver Quick Actions

**Status:** ✅ Concluída (CP1 · CP2 · CP3)
**Data:** 2026-07-21
**ADRs relacionadas:** ADR-007, ADR-008, ADR-012

## Objetivo

Permitir que o motorista opere o Visionário Drive diretamente pela
notificação persistente durante um turno ativo, sem abrir a UI
principal do app.

## Arquitetura entregue

```text
Foreground Notification
        ↓
VisionarioQuickActionsPlugin (Java — transporte puro)
        ↓
NotificationActionService (TS — tradutor)
        ↓ ↑
     EventBus  ─────  Services (Ride / Shift / RideDetection)
                          ↓
                     Repositories → CloudSync
```

## Checkpoints

### CP0.5 · Auditoria de contratos
Ver `docs/release/sprint-7-audit.md`. Nenhuma quebra de API pública.
Adições aditivas: `rideService.undoLastRide()` e eventos de bus
`notification:register` / `notification:edit-auto`.

### CP1 · Infraestrutura nativa
- Plugin Android + Foreground Service (canal `visionario_shift`,
  `IMPORTANCE_LOW`, ongoing).
- `notify(id, ...)` sobre o mesmo id — notificação única.
- `NotificationActionService` + `NotificationActionsBoot`.

### CP2 · Registrar / Finalizar / Undo
- **Registrar** → arma janela de 90s → `eventBus.emit('notification:register')` → `RegisterRideFab` existente.
- **Finalizar** → `shiftService.endAtomic`.
- **Undo** → `rideService.undoLastRide` + `plugin.hideUndo`. Timer de
  10s vive no plugin Android (`Handler.postDelayed`).

### CP3 · Auto Ride + Telemetria
- **Confirmar** → `rideDetectionService.confirmPending()` (mesmo método do `AutoRideToast`).
- **Editar** → `eventBus.emit('notification:edit-auto')` → `AutoRideToast` reabre em modo edição.
- **Descartar** → `rideDetectionService.discardPending()`.
- **Pending único** garantido por `RideDetectionService` (ADR-008).
  Zero fila paralela.
- **Telemetria** (`telemetry.recordNotification`): `notification_open`,
  `notification_register`, `notification_finish`, `notification_confirm`,
  `notification_edit`, `notification_discard`, `notification_undo`.
  Sem PII (sem email, nome, telefone, id de usuário, coordenadas,
  device id). Registrada **exclusivamente** no `NotificationActionService`.

## Critério de aceite — validação

| Item | Status |
|------|--------|
| AutoRideToast e Notificação usando o **mesmo** RideDetectionService | ✅ |
| Zero código/estado/cálculo duplicado | ✅ |
| Zero polling / setInterval / timers JS permanentes | ✅ |
| Notificação única (mesmo id, `notify(id, ...)`) | ✅ |
| Edit **não** abre Activity Java — reusa BottomSheet React | ✅ |
| Undo timer vive no Android (10s) | ✅ |
| Telemetria só em TS, sem PII | ✅ |
| tsgo · eslint · vitest verdes | ✅ |
| Build Android (assembleDebug) | ✅ (release-freeze) |

## Health Score

**9.97 → 9.98/10** (Automação sobe para 9.7).

Ver `docs/architecture/architecture-score.md`.
