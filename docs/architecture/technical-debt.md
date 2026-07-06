# Technical Debt — Sprint 3

## Eliminadas (Sprint 1 → 3)

- ❌ Fragmentação de RideModel em `RideEntry` + `ShiftRide` + `DailyEntry`
  como fontes de verdade concorrentes.
- ❌ Dupla-escrita `Shift.rides` ↔ `RideRepository`.
- ❌ Cálculos de lucro/km espalhados em `Dashboard`, `RideAnalyzer`,
  `HistoryView`, utilitários `historyAggregation`/`expenseAnalytics`.
- ❌ `SettingsService.resetAllData` (SRP violado — movido para
  `DataLifecycleService`).
- ❌ Componentes importando `cloudSync.ts` para limpar cache local.
- ❌ Componentes importando `storage.ts` para ler corridas.
- ❌ `readAllRideModels` mesclando `Shift.rides` no runtime.
- ❌ `shifts.addRide/updateRide/deleteRide` escrevendo em duas fontes.
- ❌ Regras de negócio embutidas em `cloudSync.ts`.
- ❌ Modelos `_v2`, `_new`, adapters temporários.
- ❌ **DBT-L1 (Sprint 3)** — Exceção Shift/GPS encerrada. Nenhum
  componente importa `shifts.ts`. `shiftService` (ADR-007) é a fachada
  oficial. Hooks (`useDashboard`, `useShift`, `useRides`, `useMetrics`,
  `useFinancial`, `useInsights`) consomem apenas Services e reagem via
  `eventBus` (`useSyncExternalStore`) — zero polling.

## Restantes

### Alta

_Nenhuma._ Fundação estável.

### Média

- **DBT-M1 — Migração one-shot em runtime.**
  `rideRepository.ensureMigratedFromLegacy` roda uma vez por device.
  Sprint 3 adicionou `telemetry.recordMigration` para acompanhar
  conclusão sem PII/dados sensíveis.
  - Impacto: custo pequeno de leitura, código legacy vivo.
  - Motivo: precisa continuar até >99% de devices migrados.
  - Quando remover: após 3 meses de telemetria (Sprint 5).
  - Risco: baixo.

- **DBT-M2 — Coluna `shifts.rides` no backend.**
  Continua no schema porque clientes antigos ainda enviam.
  - Impacto: peso extra no payload.
  - Motivo: compat legacy.
  - Quando remover: Sprint 4 após telemetria consolidada.
  - Risco: médio (migração destrutiva).

### Baixa

- **DBT-L2 — Adapters legacy (`rideAdapters.ts`).**
  Vivos para suportar migração e undo.
  - Quando remover: Sprint 5, junto com DBT-M1.
  - Risco: baixo.

- **DBT-L3 — `DailyEntry` como `captureMode='imported'`.**
  Timeline histórica preservada; escrita nova bloqueada.
  - Quando remover: Sprint 5.
  - Risco: baixo.

