# ADR-015 — Fronteira Nativa Agnóstica de GPS

**Status:** APROVADO — obrigatório para todas as próximas implementações
**Relaciona-se com:** ADR-004 (direção das camadas), ADR-006 (RideModel canônico),
ADR-008 (RideDetectionService), ADR-012 (NotificationActionService)

## Contexto

O Quick Form nativo (Activity Android) é o próximo ponto de entrada de
captura de corridas. O plano START **não pode** conhecer GPS; o plano PRO
precisa reutilizar exatamente a mesma tela e o mesmo pipeline, sem fork
arquitetural nem refatoração estrutural futura.

## Decisão

A camada nativa **nunca conhece GPS**. Ela apenas coleta dados da interface.
Quem interpreta esses dados é exclusivamente a camada de Service.

```text
Activity    → coleta dados
Plugin      → transporta dados
Service     → interpreta dados
Repository  → persiste
```

**Nenhuma regra de negócio pode existir antes do Service.**

### Contrato oficial da Activity (v1)

```ts
{
  value: number,
  km: number,
  kmSource: "user" | "prefilled",
  clientRequestId: string
}
```

- `kmSource` informa **apenas quem preencheu o campo**.
- A Activity **não** sabe o significado desse campo.
- A Activity **nunca** usa `gpsService`, nunca consulta localização,
  nunca decide `captureMode`, nunca decide `kmOrigin`.

### Responsabilidade do Service

`notificationActionService` traduz o contrato nativo para o domínio, e o
`rideService` aplica a regra:

| Plano | `kmSource` | `kmOrigin` | `captureMode` |
|-------|------------|------------|---------------|
| START | `user`      | `manual`   | `manual`      |
| PRO   | `prefilled` | `auto`     | `gps`         |

Se o motorista editar o KM sugerido, a Activity devolve `kmSource: "user"`
e o Service reclassifica para `manual`. Essa inteligência pertence
exclusivamente ao domínio.

### Isolamento START × PRO

O START não pode importar, depender ou conhecer:

- `gpsService`
- `gpsBackgroundProvider`
- `@capgo/background-geolocation`
- qualquer classe de rastreamento ou provider de localização

Zero import, zero `if`, zero flag, zero acoplamento na fronteira nativa.
A palavra "GPS" não atravessa a fronteira Activity ↔ Plugin.

### Compatibilidade futura

Mesma `QuickRideActivity` no PRO. Única diferença:

- **START:** KM vazio → usuário digita (`kmSource: "user"`).
- **PRO:** KM preenchido automaticamente → usuário confirma
  (`kmSource: "prefilled"`) ou altera (`kmSource: "user"`).

Nenhuma Activity nova, nenhum fluxo paralelo, nenhum fork.

## Regra definitiva — pipeline único

Toda captura de corrida — Dashboard, Quick Form, atalho, widget,
notificação, Android Auto, Wear OS — passa obrigatoriamente por:

```text
Ponto de entrada
   ↓
Plugin (transporte)
   ↓
notificationActionService (tradução)
   ↓
rideService.registerShiftRide()
   ↓
rideRepository
   ↓
Outbox
   ↓
CloudSync
   ↓
EventBus → UI
```

Nunca criar caminhos paralelos. Nunca duplicar persistência.
Nunca duplicar regras.

## Consequências

- O contrato nativo é versionado (`contractVersion: 1`); mudanças exigem
  nova versão, não campos implícitos.
- Fallback de KM automático permanece no Service (nunca na Activity) e
  degrada silenciosamente para manual quando não há GPS (START).
- Auditoria: nenhum arquivo em `android/` pode referenciar
  `location`, `gps` ou providers de rastreamento para fins de captura.

## Implementação (Sprint 10.5 — Quick Form START)

- `android/.../QuickRideActivity.java` — janela flutuante (`QuickRideDialogTheme`,
  `taskAffinity=""`, `excludeFromRecents`, `noHistory`, `singleInstance`).
  Coleta Valor, KM e Observação. Zero import de GPS, zero persistência.
- `QuickActionsForegroundService.buildNotification()` — o botão
  "Registrar corrida" agora abre a Activity via `PendingIntent.getActivity`
  (RemoteInput de texto livre removido). A `MainActivity` nunca é aberta.
- `VisionarioQuickActionsPlugin.dispatchQuickForm(...)` — transporte puro do
  contrato v1; se o Bridge ainda não carregou, a intenção é persistida em
  `SharedPreferences` e reentregue em `load()` (nenhuma corrida se perde).
- `notificationActionService.toKmOrigin()` — única tradução autorizada
  (`prefilled → auto`, `user → manual`), seguida de
  `rideService.registerShiftRide()`.
- Atualização instantânea de Dashboard, Histórico, turno ativo e notificação
  via `rides:changed` / `shift:changed` no EventBus — sem polling.
