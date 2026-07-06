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
  - `src/lib/expenses*` (legacy)
  - `src/lib/expenseAnalytics`, `src/lib/historyAggregation` (removidos)
  - Supabase client fora de Auth

### Services

- **PODEM** importar Repositories e outros Services.
- **NÃO PODEM** importar Components, `storage.ts` diretamente,
  `cloudSync.ts`, Supabase client.

### Repositories

- **PODEM** importar `storage.ts`, `cloudSync.ts`, `baseRepository`,
  `adapters/*`.
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
| `Shift` (sessão) | `shifts.ts` (raiz tracking) | `lucro-delivery-shifts` |

## Calculadora única

`MetricsService` é o **ÚNICO** local autorizado a calcular:

- lucro
- R$/km
- R$/hora
- streak
- insights
- comparativos entre períodos
- verdict (`good`/`ok`/`bad`)

## Escrita destrutiva

`DataLifecycleService` é a **ÚNICA** API destrutiva do app
(`resetAll`, `clearLocalCache`). Componentes nunca chamam
`clearAllAppData` ou `cloudSync.clearLocalCache` diretamente.

## Exceção documentada — Shift/GPS

Enquanto durar a Fase 2, os seguintes componentes podem importar
`src/lib/shifts.ts` diretamente por serem a **raiz do tracking**:

- `ShiftMode`
- `ShiftLiveMap`
- `ShiftHistoryView`
- `RegisterRideFab`
- `useShiftTracker`
- badge de turno no `Dashboard`

Migração completa está prevista na Fase 3.
