# ADR-005 — Cloud Sync é infraestrutura, nunca regra de negócio

- **Status:** Aceito (Sprint 1.5, congelado em 2.5)

## Contexto

Historicamente `cloudSync.ts` decidia como reconciliar corridas,
normalizava campos e às vezes recalculava totais durante a hidratação.

## Problema

Regras espalhadas em infraestrutura são invisíveis para o domínio.
Ninguém sabia se a "verdade" vinha do storage ou do sync.

## Decisão

`cloudSync.ts` faz **apenas** três coisas:

1. Serializar/deserializar payloads versionados.
2. Reconciliar tombstones (last-writer-wins por id).
3. Stripar campos legacy (`Shift.rides`) para não voltarem ao device.

Qualquer transformação semântica (adaptação de RideEntry → RideModel,
merge de campos) vive em `src/lib/adapters/` e é invocada pelo
Repository, nunca pelo sync.

## Alternativas

- Deixar sync com "smart merge" → repete o débito removido.

## Consequências

- Sync auditável em um único arquivo.
- Repositories testáveis sem mock de Supabase.
- Migração para outro backend fica confinada a `cloudSync.ts`.
