# Technical Debt — Sprint 4

## Eliminadas (Sprint 1 → 4)

- ❌ Fragmentação de RideModel em `RideEntry` + `ShiftRide` + `DailyEntry` como fontes concorrentes.
- ❌ Dupla-escrita `Shift.rides` ↔ `RideRepository`.
- ❌ Cálculos de lucro/km espalhados em componentes.
- ❌ `SettingsService.resetAllData` (movido para `DataLifecycleService`).
- ❌ Componentes importando `cloudSync.ts` / `storage.ts`.
- ❌ `readAllRideModels` mesclando `Shift.rides` em runtime.
- ❌ `shifts.addRide/updateRide/deleteRide` (dupla escrita).
- ❌ Regras de negócio embutidas em `cloudSync.ts`.
- ❌ Modelos `_v2`, `_new`, adapters temporários.
- ❌ **DBT-L1 (Sprint 3)** — Exceção Shift/GPS encerrada. `shiftService` (ADR-007) é a fachada oficial. Hooks reagem via `eventBus` — zero polling.
- ❌ **DBT-L4 (Sprint 4)** — Últimos 4 componentes (`GoalsView`, `SimulatorView`, `HistoryView`, `DailyInputForm`) migrados de `rideRepository` → `rideService`. **Nenhum componente em `src/components/` importa Repository diretamente.**

## Restantes

### Alta
_Nenhuma._ Fundação estável.

### Média
- **DBT-M1 — Migração one-shot em runtime.** `rideRepository.ensureMigratedFromLegacy` roda uma vez por device. Telemetria em `telemetry.recordMigration`. Remover Sprint 5.
- **DBT-M2 — Coluna `shifts.rides` no backend.** Compat legacy. Remover Sprint 5 (migração destrutiva).

### Baixa
- **DBT-L2 — Adapters legacy (`rideAdapters.ts`).** Vivos para migração/undo. Remover Sprint 5.
- **DBT-L3 — `DailyEntry` como `captureMode='imported'`.** Fachada exposta em `rideService.{listEntries,saveEntry,deleteEntry}` como `@deprecated`. Remover junto do Calculador Diário.
- **DBT-L5 (novo, Sprint 4) — Estado do detector em memória.** `rideDetectionService` mantém sessões e pending in-memory. Persistência só faz sentido junto de background service nativo (Fase 5+). Risco: baixo.
