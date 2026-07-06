# ADR-004 — Camadas unidirecionais

- **Status:** Aceito (Sprint 1.5, congelado em 2.5)

## Contexto

Componentes React importavam `storage.ts`, `cloudSync.ts`, `supabase`
e utilitários de negócio livremente. Repositories, quando existiam,
chamavam Services.

## Problema

Ciclos de dependência, testes impossíveis, regras de negócio em JSX.

## Decisão

Fluxo **estritamente unidirecional**:

```text
Components  →  Services  →  Repositories  →  Storage / CloudSync
```

- Services **nunca** importam Components.
- Repositories **nunca** importam Services.
- Components **nunca** importam Repositories, `storage.ts`,
  `cloudSync.ts` ou o client Supabase (fora de Auth).

## Alternativas

1. **Camadas por feature (vertical slice)** — bom, mas exige
   duplicação inicial de infraestrutura que ainda não temos.
2. **Hexagonal completo com ports/adapters** — sobrecarga para o
   tamanho atual do time.

## Consequências

- Testes isolados por camada.
- Refactor futuro para monorepo/packages sem retrabalho.
- Exceção documentada: **Shift/GPS raiz de tracking** (`ShiftMode`,
  `ShiftLiveMap`, `ShiftHistoryView`, `RegisterRideFab`,
  `useShiftTracker`, badge no Dashboard) ainda consome `shifts.ts`
  diretamente. Removido gradualmente na Fase 3.
