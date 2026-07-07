# Architecture Health Score — Sprint 4

| Dimensão | Nota | Justificativa |
|----------|------|---------------|
| **Single Source of Truth** | 9.6 | `RideRepository` (`vd-rides`) é dono único de `RideModel`. Detector GPS não escreve — delega para `rideService`. |
| **Layer Isolation** | 9.9 | Sprint 4 removeu os últimos 4 imports diretos de Repository em componentes. Fluxo estrito Components → Hooks → Services → Repositories. |
| **Dependency Direction** | 9.6 | Unidirecional. `rideDetectionService` comunica com `rideService` via eventBus (sem cycle). |
| **Reactivity** | 9.7 | `useSyncExternalStore` + `eventBus` (`rides:changed`, `financial:changed`, `shift:changed`, `detection:changed`, `rides:manual-registered`). Zero polling. |
| **Automation** | 9.5 | GPS automático entra como serviço puro determinístico, com confidence score e pending intermediário. Motorista mantém controle total (edit/discard/undo). |
| **Offline-first** | 9.5 | Toda escrita persiste local antes do sync. |
| **Cloud Sync** | 9.0 | Schema versioning + strip legacy. |
| **Insights** | 9.0 | `metricsService.insights` determinístico, ≤3. |
| **Legacy** | 8.8 | Adapter/leitura removíveis com telemetria. `rideService` expõe legacy DailyEntry como `@deprecated`. |
| **Maintainability** | 9.5 | ADRs 001–008, checklist, hooks encapsulam services. |
| **Scalability** | 9.6 | Modelo canônico versionado, sync incremental, hooks memoizados, detector pronto para overrides configuráveis. |
| **Architecture Overall** | **9.7** | Fundação estável, ativada e agora automatizada. |

## O que subiu vs Sprint 3

- **Layer Isolation** 9.8 → 9.9 (fim dos 4 imports diretos restantes).
- **Reactivity** 9.5 → 9.7 (bus estendido com `detection:changed`).
- **Automation** (novo) — 9.5.
- **Maintainability** 9.4 → 9.5.
- **Overall** 9.6 → **9.7**.

## IAM — Índice de Automação do Motorista (baseline Sprint 4)

| Métrica | Antes | Depois |
|---|---|---|
| Toques para registrar corrida | 4–6 (FAB → valor → km → salvar) | 0 (auto) ou 1 (undo) |
| Ações executadas pelo app sozinho | 0 | 1 por corrida detectada + polling GPS |
| Tempo economizado / turno estimado | 0 | ~20–40s × N corridas |
| Precisão do detector | — | `telemetry.detectionAccuracy()` |

## Recomendações Sprint 5

1. UI de calibração de sensibilidade (thresholds do detector) por motorista.
2. Preparar remoção de `shifts.rides` no backend (DBT-M2).
3. Consolidar `DailyEntry` legacy (DBT-L3) após 3 meses de telemetria.
4. CI que rode `docs/architecture/architecture-checklist.md` bloqueando imports diretos de Repository.
