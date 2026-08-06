# ADR-012 — NotificationActionService (Driver Quick Actions completo)

**Status:** Aceito (Sprint 7 · Checkpoint 3)
**Relaciona-se com:** ADR-004 (camadas), ADR-007 (ShiftService), ADR-008 (RideDetectionService)

## Contexto

A Sprint 7 introduziu a **notificação persistente** durante o turno
ativo. Os Checkpoints 1 e 2 entregaram infraestrutura (Foreground
Service, plugin Capacitor) e ligaram Registrar / Finalizar / Undo. O
Checkpoint 3 fecha o módulo integrando a **detecção automática de
corridas** (ADR-008) à mesma notificação — sem duplicar UI, estado ou
regras.

## Decisão

`NotificationActionService` (TS, `src/lib/services/notificationActionService.ts`)
é o **único** tradutor entre o plugin nativo `VisionarioQuickActions`
e as camadas oficiais. Nenhuma regra de negócio vive no plugin Java;
nenhum acesso a Repository/Storage/Supabase/CloudSync vive no service.

### Fluxo Auto Ride (CP3)

```text
RideDetectionService
     │  detection:changed
     ▼
NotificationActionService.handleDetection
     │  plugin.showAutoRideCandidate({ resumo })
     ▼
Notificação persistente (Confirmar · Editar · Descartar)
```

- **Confirmar** → `rideDetectionService.confirmPending()` (mesmo método
  que o `AutoRideToast` chama). Persistência via `RideService` →
  `RideRepository` → `CloudSync`. `rides:changed` volta ao bus e
  dispara `pushContent`. `detection:changed` (com pending=null)
  dispara `hideAutoRideCandidate`. Zero fluxo paralelo.
- **Editar** → `eventBus.emit('notification:edit-auto')`. O
  `AutoRideToast` existente escuta o sinal e reabre o mesmo toast já
  em modo edição. **Não** cria Activity nativa. **Não** cria rota nova.
- **Descartar** → `rideDetectionService.discardPending()` (mesmo método
  do toast). `detection:changed` dispara `hideAutoRideCandidate`.

### Estado do Pending

Apenas **um** `PendingRide` ativo — política mantida pelo
`RideDetectionService` (ADR-008). O `NotificationActionService`
memoriza somente o `id` do último pending sinalizado à notificação
(`lastPendingId`) para evitar `showAutoRideCandidate` duplicados. Não
existe fila paralela nem cache de dados de detecção.

### Telemetria

Contadores agregados **sem PII** vivem em
`telemetry.recordNotification(counter)`:

- `notification_open`
- `notification_register`
- `notification_finish`
- `notification_confirm`
- `notification_edit`
- `notification_discard`
- `notification_undo`

Toda gravação ocorre **exclusivamente** dentro do
`NotificationActionService`. O plugin Java jamais grava telemetria.

## Consequências

**Positivas**
- `AutoRideToast` e Notificação podem coexistir ativos: ambos usam o
  mesmo `RideDetectionService`, o mesmo `PendingRide` e o mesmo
  `RideService`.
- Zero UI duplicada — editar sempre abre o mesmo BottomSheet React.
- Reatividade 100% via `EventBus` (sem timers JS, sem polling).
- Undo mantém o timer no Android (`Handler.postDelayed` — 10s).

**Negativas**
- `lastPendingId` é estado em memória — reinicialização do bundle
  reseta a supressão de duplicatas. Aceito: consequência prática é no
  máximo um `showAutoRideCandidate` extra logo após o reload, sem
  duplicação de corrida (a detecção continua sendo a mesma).

## Verificação

- `rg "rideRepository|storage|cloudSync|supabase" src/lib/services/notificationActionService.ts` → vazio.
- `rg "recordNotification" android/` → vazio (telemetria só em TS).
- `rg "confirmPending|discardPending" src/lib/services/notificationActionService.ts` → chamadas idênticas às do `AutoRideToast`.
- Suíte `notificationActionService.test.ts` cobre confirm/edit/discard/undo/register/finish + auto-show/hide + telemetria.

## Adendo — Sprint 10.4.8 (Quick Register inline)

`Registrar corrida` deixou de abrir a MainActivity. A ação agora carrega
um **RemoteInput** (`quick_ride_input`), então o formulário rápido
acontece dentro da central de notificações — o motorista permanece no
Uber/99/iFood.

```text
Notificação (RemoteInput) → QuickActionsReceiver
   → VisionarioQuickActionsPlugin.dispatchAction(action, raw)
   → NotificationActionService.handleInlineRegister
   → parseQuickRideInput (adapter de entrada, sem regra de negócio)
   → rideService.registerShiftRide  ← MESMO fluxo do RegisterRideFab
   → RideRepository → CloudSync
   → EventBus (rides:changed / rides:manual-registered / shift:changed)
   → Dashboard, Histórico, Turno e Notificação atualizam
```

- Sem storage paralelo. Único desvio: fila **em memória** no plugin
  (`PENDING`) quando o Bridge ainda não carregou; drenada em `load()`.
- `PendingIntent` da ação Registrar é MUTABLE (exigência do RemoteInput);
  as demais permanecem IMMUTABLE.
- Feedback via `showToast` nativo (Toast Android), pois nenhuma UI web
  está visível.
- Fallback: device sem inline reply → comportamento anterior
  (`notification:register` + modal React).
