# ADR-001 — RideRepository é a única fonte de verdade

- **Status:** Aceito (Sprint 2.4, congelado em 2.5)
- **Data:** 2026-07-06

## Contexto

Antes da Fase 2, dados de corrida viviam em três locais paralelos:
`lucro-delivery-rides` (RideEntry legacy), `Shift.rides` (dentro do
`lucro-delivery-shifts`) e `DailyEntry` (agregador diário). Cada
componente escolhia sua própria fonte, gerando divergência de métricas,
duplicação em cloud sync e retrabalho em cada feature nova.

## Problema

Sem um owner único, era impossível garantir:

- consistência de lucro/km entre Dashboard, History e Analyzer;
- que uma edição em um lugar refletisse nos demais;
- migração futura para features Pro (IA, insights, GPS automático).

## Decisão

`RideRepository` (`src/lib/repositories/rideRepository.ts`) é o **único**
owner de `RideModel`. Fonte física: `localStorage['vd-rides']`
(payload versionado `{ schemaVersion, rides }`). Toda leitura passa por
`readAllRideModels()` ou pelos métodos do repositório. Toda escrita passa
por `RideService`.

## Alternativas consideradas

1. **Manter dual-write com sync no cloud** — mantém o débito e piora a
   entropia à medida que novas capturas (GPS, IA) entram.
2. **Migrar direto para Supabase server-side** — quebra o requisito
   offline-first e adia meses.
3. **Adotar CRDT** — over-engineering para o volume atual.

## Consequências

**Positivas**

- Métricas coerentes em todo o app.
- Cloud sync serializa uma única entidade (`vd-rides`).
- Base pronta para GPS automático, IA, insights (Fase 3+).

**Negativas**

- `Shift.rides` continua no cloud legacy por compatibilidade (stripado
  na hidratação/push por `cloudSync.stripLegacyRides`).
- Migração one-shot em `ensureMigratedFromLegacy` precisa permanecer
  até termos telemetria confirmando >99% dos devices migrados.
