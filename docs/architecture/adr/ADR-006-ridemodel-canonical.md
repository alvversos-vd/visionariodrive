# ADR-006 — RideModel é o modelo canônico

- **Status:** Aceito (Sprint 2.1, congelado em 2.5)

## Contexto

Coexistiam `RideEntry` (legacy), `ShiftRide` (interno ao Shift) e
`DailyEntry` (agregado). Cada tela usava um.

## Problema

Impossível evoluir features Pro (GPS trace, IA, insights) sem um
modelo único e versionado.

## Decisão

`RideModel` (`src/lib/domain/models.ts`) é o **único** modelo canônico.
Contém captura (`captureMode`), analytics snapshot, GPS, breakdown de
ganhos, histórico de edições e binding opcional a `shiftId`. Está
versionado via `RIDE_SCHEMA_VERSION`.

Modelos legacy (`RideEntry`, `ShiftRide`, `DailyEntry`) sobrevivem
**apenas** como shapes de leitura/adapter (`src/lib/adapters/rideAdapters.ts`)
e serão eliminados quando a migração one-shot estabilizar.

## Alternativas

- Modelos por captura (RideManual, RideGps, RideImported) — explode a
  matriz de conversões.

## Consequências

- Um único payload em `vd-rides`.
- Bump de schema controlado (`schemaVersion`) para futuras migrações.
- Componentes trabalham num único type — TS elimina classes inteiras
  de bug.
