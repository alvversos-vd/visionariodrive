# Sprint 7 — Driver Quick Actions (Plataforma Nativa Definitiva)

Sprint de **plataforma**, não de produto. Nenhuma regra nova. Apenas expor via notificação nativa Android o que já existe em Services. Zero deep-link, zero rota nova, zero UI Java duplicada.

---

## Arquitetura obrigatória (não-negociável)

```text
Foreground Notification (Android)
        ↕
VisionarioQuickActionsPlugin (Java, apenas transporte)
        ↕
NotificationActionService (TS, apenas tradução)
        ↓                              ↘
RideService · ShiftService ·             eventBus.emit('notification:*')
rideDetectionService · MetricsService              ↓
        ↓                              UI React existente
Repositories · CloudSync · EventBus     (RegisterRideFab / AutoRideToast)
        ↑
NotificationActionService assina EventBus e chama plugin.updateContent(...)
```

Plugin **não** toca Storage/Repository/Supabase. Service TS **não** persiste, calcula ou aplica regra. UI de edição continua **React**, aberta por evento no bus — **sem rota `/quick-register`, sem deep-link, sem navegação**.

---

## GATE 0 — Leitura obrigatória

Ler e confirmar contratos: `rideService`, `shiftService`, `financialService`, `metricsService`, `rideDetectionService`, `cloudSync`, `eventBus`, hooks reativos, ADRs 001–011, `public-api.md`, `roadmap.md`, `architecture-score.md`.

## GATE 1 — Proibições

Sem novo domínio, Repository, Storage, CloudSync, EventBus paralelo, cache, polling, timer JS permanente, regra de negócio, fluxo offline paralelo, UI Java duplicada, **rota nova**, **deep-link novo**.

## GATE 2 — Fluxo único

Notification → Plugin → `NotificationActionService` → Service existente → Repository → CloudSync → EventBus → Hook/BottomSheet existente → UI.

## GATE 3 — Regressão

Ao final de cada CHECKPOINT: `tsgo`, `eslint`, `vitest run`. Se algo quebrar: parar, corrigir, reexecutar.

---

## CHECKPOINT 0.5 — Auditoria de contratos (antes de qualquer arquivo)

Confirmar que existem, com exatamente estas assinaturas públicas:

- `rideService.createRide(...)`
- `shiftService.endAtomic(turnoId)` e `shiftService.getActive()` e `shiftService.getTotals(shift)`
- `rideDetectionService.confirmPending()` e `rideDetectionService.discardPending()` (promover a público se estiverem privados — **sem** alterar lógica)
- `eventBus` emite `rides:changed`, `shift:started`, `shift:finished`, `shift:changed`, `detection:changed`
- `RegisterRideFab` (ou equivalente) pode ser aberto por sinal externo (adicionar prop `openSignal?: number` derivada de `useBusVersion('notification:register')` — **reuso puro, mesmo componente, mesma lógica**)

Se qualquer contrato divergir: **PARAR**, gerar `docs/release/sprint-7-audit.md`, **não** adaptar arquitetura, **não** criar workaround.

Adicionar ao `eventBus` os eventos de **transporte UI** (não são regra de negócio, são sinais one-shot para abrir componentes existentes):

- `notification:register`
- `notification:edit-auto`

Nada mais. Estes eventos vivem no bus oficial, não em bus paralelo.

---

## CHECKPOINT 1 — Infraestrutura (transporte puro)

### Android (Java)

- `VisionarioQuickActionsPlugin.java` — `@CapacitorPlugin(name="VisionarioQuickActions")`. Métodos: `start`, `stop`, `updateContent`, `showAutoRideCandidate`, `showUndo`, `hideUndo`. Emite `notifyListeners("action", {type, payload?})`.
- `QuickActionsForegroundService.java` — `Service` com `startForeground(id, notification)`, canal `visionario_shift` (`IMPORTANCE_LOW`, ongoing, silencioso). `BigTextStyle`. Atualização usa `notify(id, builder.build())` sobre o **mesmo** id — jamais recria o Service.
- `QuickActionsReceiver.java` — `BroadcastReceiver` traduzindo `ACTION_REGISTER | ACTION_FINISH | ACTION_CONFIRM_AUTO | ACTION_EDIT_AUTO | ACTION_DISCARD_AUTO | ACTION_UNDO` em `notifyListeners`.
- **Timer do Undo (10s)** vive **exclusivamente** no plugin (`Handler.postDelayed` → `hideUndo`). Nunca em JS.
- `AndroidManifest.xml`: `<service android:foregroundServiceType="location">`, `<receiver>`, permissões já presentes.
- `MainActivity.java`: `registerPlugin(VisionarioQuickActionsPlugin.class)`.

### TypeScript

- `src/lib/native/quickActionsPlugin.ts` — `registerPlugin<QuickActionsPlugin>('VisionarioQuickActions')` com stub no-op para web/PWA.
- `src/lib/services/notificationActionService.ts` — **apenas tradução**:
  - `attach()` / `detach()`.
  - Assina bus (`rides:changed`, `shift:started/finished/changed`, `detection:changed`) e chama `plugin.updateContent(...)` com totais lidos de `shiftService.getTotals(active)`. Sem PII.
  - `shift:started` → `plugin.start()`; `shift:finished` → `plugin.stop()`.
  - `detection:changed` → se há pending, `plugin.showAutoRideCandidate({valor, app})`.
  - Escuta `action` do plugin e traduz:
    - `register` → `eventBus.emit('notification:register')` (UI abre BottomSheet existente).
    - `finish` → `shiftService.endAtomic(active.turno_id)`.
    - `confirm-auto` → `rideDetectionService.confirmPending()`.
    - `edit-auto` → `eventBus.emit('notification:edit-auto')` (UI reabre `AutoRideToast`/form existente com pending).
    - `discard-auto` → `rideDetectionService.discardPending()`.
    - `undo` → `rideService.undoLastRide()`.
  - Cada handler chama `telemetry.recordNotification(...)`.
- `src/components/native/NotificationActionsBoot.tsx` — componente `null` montado uma vez em `App.tsx`; `attach()` no mount, `detach()` no unmount.
- Componentes UI existentes assinam os novos eventos com `useBusVersion`:
  - `RegisterRideFab` já é ponto único de registro manual → escuta `notification:register` e abre o próprio sheet.
  - `AutoRideToast` já lida com pending → escuta `notification:edit-auto` e força modo de edição.

Fim: verde. Parar.

---

## CHECKPOINT 2 — Registrar / Finalizar / Undo

- **Registrar**: evento `notification:register` reabre `RegisterRideFab` existente; salvar continua chamando `rideService.createRide(...)`.
- **Finalizar**: `shiftService.endAtomic(active.turno_id)`. Confirmação = duplo-tap no plugin (≤ 4s), sem estado JS.
- **Undo**: adicionar `rideService.undoLastRide(): Promise<boolean>` reutilizando `rideRepository.remove(lastId)` já existente (sem duplicar código). Após `createRide` bem-sucedido a partir da notificação, o service dispara `plugin.showUndo({resumo})`; plugin agenda `hideUndo` em 10s.

Fim: verde. Parar.

---

## CHECKPOINT 3 — Auto Ride + Telemetria

- `detection:changed` → `showAutoRideCandidate({valor, app})`.
- **Confirmar** → `rideDetectionService.confirmPending()`.
- **Editar** → `eventBus.emit('notification:edit-auto')` (UI React existente assume). Zero rota nova.
- **Descartar** → `rideDetectionService.discardPending()`.
- `src/lib/telemetry.ts`: adicionar contadores `notification_open`, `notification_register`, `notification_finish`, `notification_confirm`, `notification_edit`, `notification_discard`, `notification_undo`. Sem PII.

Fim: verde. Parar.

---

## UI da notificação

- Título: `Turno em andamento`
- Linhas: `08h41 · 7 corridas · 82 km · R$214,50`
- Sem PII, sem coordenadas, sem nome, sem ID.
- Notificação nunca recriada — só `notify(id, ...)`.

## Offline

Zero mudança em CloudSync/fila/persistência. Tudo passa pelos Services existentes, que já são offline-first.

## Testes

- `notificationActionService.test.ts` — mock do plugin + Services; cobre `attach/detach`, cada handler, `updateContent` disparado por cada evento do bus, emissão de `notification:register` e `notification:edit-auto`.
- `rideService.undoLastRide.test.ts` — cria/undo/estado final; garante `rides:changed`.
- `quickActionsPlugin.mock.test.ts` — verifica stub web no-op e shape dos payloads.

## Documentação

- `docs/architecture/adr/ADR-012-driver-quick-actions.md`.
- `docs/release/sprint-7.md` — plano + QA em device físico.
- `docs/architecture/public-api.md` — `notificationActionService.{attach,detach}`, `rideService.undoLastRide`, `rideDetectionService.confirmPending/discardPending`, novos eventos `notification:register` / `notification:edit-auto`.
- `docs/architecture/roadmap.md` — Sprint 7 concluída.
- `docs/architecture/architecture-score.md` — meta ≥ 9.95.

---

## Critério de Reprovação (Sprint inválida se ocorrer qualquer item)

- Duplicação de código.
- Lógica repetida entre Plugin e Service.
- Repository acessado fora dos Services.
- Acesso direto a `localStorage`.
- Acesso direto ao Supabase client (fora de Auth).
- Polling.
- Timer JS permanente.
- Navegação/rota criada só para esta Sprint.
- Deep-link novo.
- UI de formulário em Java.
- Qualquer alteração na arquitetura existente.
- Bus paralelo ou cache paralelo.
- Qualquer quebra de API pública.

## Definição de concluído

Motorista inicia turno, minimiza app; pela notificação: registra corrida (abre BottomSheet React via bus), confirma automática, edita (React via bus), desfaz (timer Android), finaliza turno. Offline preservado. Health Score ≥ 9.95. Código indistinguível do resto da arquitetura.

## Fora do escopo

iOS, widgets, Android Auto, PRO.

---

Confirmar para iniciar pelo **CHECKPOINT 0.5** (auditoria de contratos + adição dos eventos `notification:register` / `notification:edit-auto` no bus).
