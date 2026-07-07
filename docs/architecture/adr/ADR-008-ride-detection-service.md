# ADR-008 — RideDetectionService (GPS Automático)

**Status:** Aceito (Sprint 4)
**Substitui:** —
**Relaciona-se com:** ADR-001, ADR-002, ADR-006, ADR-007

## Contexto

A partir da Sprint 3 a arquitetura está congelada: `RideRepository` é a
única fonte de verdade de `RideModel`, `RideService` é a única porta de
escrita e `ShiftService` é a única fachada de tracking. O motorista
ainda precisava tocar no FAB toda vez que terminava uma corrida — a
plataforma tinha os dados de GPS, mas não trabalhava por ele.

## Decisão

Introduzir `rideDetectionService` como um **serviço puro em memória**
que consome fixes GPS já filtrados por `useShiftTracker` e detecta
corridas de forma determinística.

### Regras invariantes

1. **Não é fonte de verdade.** Toda persistência definitiva vai para
   `rideService.addGpsRide` → `RideRepository`. O detector nunca escreve
   em storage.
2. **Não abre novo watcher GPS.** Reaproveita o watcher do
   `useShiftTracker` (bateria = zero regressão).
3. **Determinístico.** Máquina de estados IDLE → MOVING → STOPPING →
   IDLE com thresholds em `rideDetectionConfig`. Sem IA, sem ML, sem
   API externa.
4. **Confidence score explícito.** Combina distância, duração,
   velocidade média, precisão média do GPS e nº de fixes num score 0–100.
   Corridas abaixo de `minConfidence` (default 60) são descartadas
   silenciosamente e ficam contabilizadas em `gps_detection` para
   ajuste futuro dos thresholds.
5. **Pending intermediário.** Toda detecção nasce como `PendingRide`
   em memória. O motorista tem `pendingTimeoutSeconds` (default 15s)
   para Confirmar / Editar / Descartar. Sem ação → auto-confirma.
6. **Undo pós-persistência.** Após salvar, um toast com Desfazer fica
   ativo por `undoWindowSeconds` (default 6s). O undo remove a corrida
   via `rideService.deleteRide` e atualiza contadores de telemetria.
7. **Comunicação por eventos.** Notifica a UI via
   `eventBus.emit('detection:changed')`. `AutoRideToast` reage via
   `useSyncExternalStore` — zero polling.

### Falsos negativos

`rideService.registerShiftRide` emite `rides:manual-registered`. O
detector assina esse evento e, se estava em MOVING com >100m
acumulados, incrementa `gps_false_negative`. Assim medimos casos em
que o detector deveria ter agido antes do driver.

### Configuração

`rideDetectionConfig.ts` centraliza todos os thresholds. Sprint 4
retorna apenas defaults. Sprint 5+ pode ler overrides de
`settingsService` sem alterar o service — o contrato já é assíncrono
via função `getRideDetectionConfig()`.

## Consequências

- **Positivas:**
  - Zero mudança de camadas (Components → Services → Repositories).
  - Zero acesso novo a storage.
  - Reutiliza watcher GPS — sem custo extra de bateria.
  - Falsos positivos monitoráveis via `telemetry.detectionAccuracy()`.
  - Motorista mantém controle total via undo/edit/discard.

- **Negativas:**
  - Estado do detector é em memória (reset em reload). Aceito para
    Sprint 4 — a corrida em andamento é reconstruída ao reabrir via
    fixes novos; o "pending" perdido é raro.
  - Detector inteiro depende do watcher ativo do `useShiftTracker`.

## Alternativas descartadas

- **Persistir pending no storage.** Adicionaria uma nova fonte de
  verdade parcial. Ferimos ADR-001 e ADR-006 sem ganho real (janela é
  de segundos).
- **Detectar corridas no `shifts.ts`.** Reintroduziria regra de
  negócio na infra, quebrando ADR-004.
- **Usar ML/heurísticas online.** Fora do escopo Sprint 4 e do
  princípio de determinismo cobrado pelo CTO.

## Verificação

- `rg "rideRepository" src/components/` → vazio.
- `rg "storage" src/lib/services/rideDetectionService.ts` → vazio.
- Confidence score é função pura sobre a sessão + config.
- `AutoRideToast` desmonta via `toast.dismiss` e não mantém listeners
  fora do `useEffect`.
