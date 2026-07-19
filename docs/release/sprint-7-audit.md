# Sprint 7 — Checkpoint 0.5 · Auditoria de Contratos

**Status:** ✅ APROVADO — implementação pode prosseguir para o Checkpoint 1.
**Data:** 2026-07-19
**Escopo:** Validar que a Sprint 7 (Driver Quick Actions) pode ser construída **sem alterar** nenhuma API pública nem duplicar lógica.

---

## ✅ Contratos encontrados e compatíveis

| Contrato exigido | Localização | Assinatura |
|---|---|---|
| `rideService.createRide` (fluxo manual) | `src/lib/services/rideService.ts:220` | `saveManualRide(input)` / `saveQuickRide(input)` / `registerShiftRide(input)` — cobrem os 3 casos que a notificação precisa |
| `rideService.deleteRide` | `rideService.ts:212` | `deleteRide(id: string): void` |
| `rideService.listByShift` | `rideService.ts:185` | `(shiftId) => RideModel[]` |
| `shiftService.getActive` | `shiftService.ts:32` | `(): Shift \| null` |
| `shiftService.endAtomic` | `shiftService.ts:44` | `(turnoId): Promise<Shift \| null>` — emite `shift:finished` |
| `shiftService.getTotals` | `shiftService.ts:56` | `(shift) => ShiftTotals` (tempo, corridas, km, lucro) — cobre a UI da notificação |
| `rideDetectionService.getPending` | `rideDetectionService.ts:242` | `(): PendingRide \| null` |
| `rideDetectionService.confirmPending` | `rideDetectionService.ts:248` | `(patch?): string \| null` — já persiste via `rideService.addGpsRide` e emite `detection:changed` |
| `rideDetectionService.discardPending` | `rideDetectionService.ts:271` | `(opts?): void` — emite `detection:changed` |
| `eventBus` — eventos oficiais | `src/lib/eventBus.ts` | `rides:changed`, `shift:started/finished/changed`, `detection:changed` — todos presentes |
| Persistência emite bus | `rideRepository.ts:76` | `persist()` emite `rides:changed` — `undoLastRide` herda sem código extra |

**Conclusão parcial:** Todos os fluxos exigidos pelo RFC estão implementados nos Services corretos. Nenhum acesso a Repository/Storage/Supabase será necessário fora dos Services.

---

## ⚠️ Contratos ausentes

Nenhum contrato exigido está ausente. Duas **adições mínimas** (não-quebrantes) foram identificadas e classificadas na próxima seção.

---

## 📌 Adições estruturais aplicadas neste Checkpoint 0.5

Ambas são **aditivas** — nenhuma API existente foi alterada, renomeada ou removida.

### 1. `rideService.undoLastRide(): string | null`

- **Motivo:** o RFC exige "Desfazer" pela notificação.
- **Reúso:** delega a `this.deleteRide()` → `rideRepository.remove()` → `persist()` → `eventBus.emit('rides:changed')`. **Zero duplicação de lógica** de remoção.
- **Local:** `src/lib/services/rideService.ts` (extremo do objeto público).
- **Regra de negócio nova:** não. Apenas seleciona `last = max(rides.date)` e chama o `deleteRide` já existente.

### 2. Eventos de transporte UI no `eventBus`

- `notification:register`
- `notification:edit-auto`

- **Motivo:** substituem qualquer deep-link/rota. A UI React existente (`RegisterRideFab`, `AutoRideToast`) passa a assinar esses sinais para abrir seus próprios sheets/toasts, mantendo **um único** ponto de UI de registro.
- **Natureza:** sinais one-shot sem payload, seguindo o padrão do bus (ADR-004). **Não** são fonte de verdade, **não** carregam dados.
- **Local:** `src/lib/eventBus.ts` — `BusEvent` union e array `EVENTS` (ambos atualizados).
- **Bus paralelo?** Não — reusa o `eventBus` oficial.

---

## 🚫 Divergências que impediriam a implementação

**Nenhuma.**

- Nenhuma API pública precisou ser alterada.
- Nenhum Repository precisou ser exposto a novos consumidores.
- Nenhum novo Storage/CloudSync foi introduzido.
- Nenhuma nova rota, deep-link ou navegação foi requerida.
- Nenhum componente React precisa ser reescrito — apenas passa a assinar os 2 novos sinais.

---

## Fluxo confirmado (idêntico ao aprovado pelo CTO)

```text
Foreground Notification
        ↓
VisionarioQuickActionsPlugin (Java — apenas transporte)
        ↓
NotificationActionService (TS — apenas tradução)
        ↓
EventBus (notification:register / notification:edit-auto)
        ↓
RegisterRideFab / AutoRideToast (UI React existente)
        ↓
RideService · ShiftService · rideDetectionService
        ↓
Repositories
        ↓
CloudSync
        ↓
EventBus (rides:changed / shift:* / detection:changed)
        ↓
NotificationActionService (assinante)
        ↓
plugin.updateContent(...)
```

---

## Veredito

**GO para Checkpoint 1.** Nenhuma mudança estrutural adicional será feita durante os próximos checkpoints — apenas Plugin Android, Foreground Service, `NotificationActionService` e `NotificationActionsBoot`, todos consumindo os contratos acima.
