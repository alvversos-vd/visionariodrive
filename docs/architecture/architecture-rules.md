# Architecture Rules — Visionário Drive (FROZEN)

> Sprint 2.5. Toda violação é bug arquitetural. Pull requests que
> quebrem estas regras devem ser rejeitados na revisão.

## Camadas

```text
Components (React)
    │  pode importar
    ▼
Services  ──────────────── único local de regra de negócio
    │  pode importar
    ▼
Repositories  ──────────── único owner de entidade
    │  pode importar
    ▼
Storage (localStorage)     Cloud Sync (Supabase)
```

## Regras por camada

### Components (React)

- **PODEM** importar:
  - `src/lib/services/*`
  - `src/lib/domain/models` (tipos)
  - `src/lib/adapters/*` (tipos apenas)
  - `src/integrations/supabase/client` **somente para Auth**
- **NÃO PODEM** importar:
  - `src/lib/repositories/*`
  - `src/lib/storage.ts`
  - `src/lib/cloudSync.ts`
  - `src/lib/shifts.ts` (**usar `shiftService`** — ADR-007)
  - `src/lib/expenses*` (legacy)
  - `src/lib/expenseAnalytics`, `src/lib/historyAggregation` (removidos)
  - Supabase client fora de Auth

### Services

- **PODEM** importar Repositories e outros Services.
- **NÃO PODEM** importar Components, `storage.ts` diretamente,
  `cloudSync.ts`, Supabase client.

### Repositories

- **PODEM** importar `storage.ts`, `cloudSync.ts`, `baseRepository`,
  `adapters/*`, `eventBus`, `telemetry`.
- **NUNCA** importam Services ou Components.

### Storage / Cloud

- Puros. Nenhum import de camadas superiores.

## Owners únicos

| Entidade | Owner | Storage key |
|----------|-------|-------------|
| `RideModel` | `RideRepository` | `vd-rides` |
| `FinancialEntry` | `FinancialRepository` | `vd-financial` |
| `Vehicle` | `VehicleRepository` | `vd-vehicles` |
| `Goals` | `GoalsRepository` | `vd-goals` |
| `Settings` | `SettingsRepository` | `vd-settings` |
| `Profile` | `ProfileRepository` | `vd-profile` |
| `Tags` | `TagsRepository` | `vd-tags` |
| `Shift` (sessão) | `shifts.ts` (infra, encapsulado por `shiftService`) | `lucro-delivery-shifts` |

## Calculadora única

`MetricsService` é o **ÚNICO** local autorizado a calcular:

- lucro
- R$/km
- R$/hora
- streak
- insights (Sprint 3 — máx. 3, determinístico)
- comparativos entre períodos
- verdict (`good`/`ok`/`bad`)

## Escrita destrutiva

`DataLifecycleService` é a **ÚNICA** API destrutiva do app
(`resetAll`, `clearLocalCache`). Componentes nunca chamam
`clearAllAppData` ou `cloudSync.clearLocalCache` diretamente.

## Tracking (Shift) — ADR-007

A exceção histórica está encerrada. `src/lib/shifts.ts` é
infraestrutura e só pode ser importado por:

- `src/lib/services/shiftService.ts` (fachada pública oficial)
- `src/lib/services/rideService.ts` (orquestração `registerShiftRide`)
- `src/lib/repositories/rideRepository.ts` (migração one-shot legacy)
- `src/lib/cloudSync.ts` / `src/lib/exportShifts.ts` (infra pura)

Componentes e hooks importam **exclusivamente** `shiftService`.

