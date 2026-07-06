# Technical Roadmap — Pós Sprint 3

## Sprint 3 — Ativação da Fundação ✅ CONCLUÍDA

| Item | Status |
|------|--------|
| Hooks `useRides` / `useMetrics` / `useFinancial` / `useShift` / `useDashboard` | ✅ |
| Migrar Shift/GPS para Services (`shiftService`, encerra DBT-L1) | ✅ ADR-007 |
| Telemetria one-shot (`telemetry.recordMigration`) | ✅ |
| Insights v1 (`metricsService.insights`, máx. 3) + `InsightsCard` | ✅ |
| `eventBus` reativo (`rides:changed`, `financial:changed`, `shift:changed`) | ✅ |


## Sprint 4 — Expansão

| Item | Objetivo | Dependências | Risco | Prioridade |
|------|----------|--------------|-------|------------|
| GPS automático de corridas | Detectar rides via `gpsService` + `addGpsRide` | ADR-001, ADR-006 | Alto | Alta |
| Bulk export/import RideModel | Backup local + share | Adapters | Médio | Média |
| Remover coluna `shifts.rides` | Encerrar DBT-M2 | Telemetria Sprint 3 | Alto | Média |

## Sprint 5 — Consolidação

| Item | Objetivo | Dependências | Risco | Prioridade |
|------|----------|--------------|-------|------------|
| CI de arquitetura | Rodar checklist como gate | Checklist | Baixo | Alta |
| Web Worker p/ metrics | Sair da main thread | MetricsService puro | Médio | Média |
| Remover `ensureMigratedFromLegacy` | Encerrar DBT-M1 | Telemetria | Médio | Média |

## PRO (Fase 3+)

| Item | Objetivo | Dependências | Risco | Prioridade |
|------|----------|--------------|-------|------------|
| IA de insights avançados | LLM consumindo `RideModel` histórico | AI Gateway | Alto | Alta |
| Comparativos entre motoristas | Requer telemetria opt-in | LGPD, consentimento | Alto | Média |
| Previsão de ganhos | Modelo estatístico sobre `metricsService` | MetricsService | Médio | Média |
| Antifraude estrutural | Detecção de padrões anômalos | RideModel completo | Alto | Alta |

## Princípios de priorização

1. Nenhuma feature Pro pode quebrar START.
2. Nenhuma feature nova pode introduzir owner duplicado.
3. Toda mudança em API pública requer ADR.
4. Débitos M/A bloqueiam features que dependem deles.
