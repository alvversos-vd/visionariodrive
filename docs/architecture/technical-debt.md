# Technical Debt — Sprint 2.5

## Eliminadas (Sprint 1 → 2.4)

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

## Restantes

### Alta

_Nenhuma._ Fundação considerada estável.

### Média

- **DBT-M1 — Migração one-shot em runtime.**
  `rideRepository.ensureMigratedFromLegacy` roda a cada boot sem
  telemetria de conclusão.
  - Impacto: custo pequeno de leitura, código legacy vivo.
  - Motivo: precisa continuar até termos >99% de devices migrados.
  - Quando remover: após 3 meses de telemetria (Fase 4).
  - Risco: baixo.

- **DBT-M2 — Coluna `shifts.rides` no backend.**
  Continua no schema porque clientes antigos ainda enviam.
  - Impacto: peso extra no payload.
  - Motivo: compat legacy.
  - Quando remover: Fase 4 (após deprecação de versões antigas).
  - Risco: médio (migração destrutiva).

### Baixa

- **DBT-L1 — Exceção Shift/GPS.**
  6 componentes ainda importam `shifts.ts` diretamente.
  - Impacto: baixo, está documentado.
  - Quando remover: Fase 3.
  - Risco: baixo.

- **DBT-L2 — Adapters legacy (`rideAdapters.ts`).**
  Vivos para suportar migração e undo.
  - Quando remover: Fase 4, junto com DBT-M1.
  - Risco: baixo.

- **DBT-L3 — `DailyEntry` como `captureMode='imported'`.**
  Timeline histórica preservada; escrita nova bloqueada.
  - Quando remover: Fase 4.
  - Risco: baixo.
