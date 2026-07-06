# ADR-003 — MetricsService é o único responsável por cálculos

- **Status:** Aceito (Sprint 1.5, congelado em 2.5)

## Contexto

Cálculos de lucro, R$/km, R$/h, streak e insights estavam espalhados em
componentes (`Dashboard`, `RideAnalyzer`, `HistoryView`) e utilitários
soltos (`historyAggregation`, `expenseAnalytics`).

## Problema

Fórmulas divergiam entre telas. Um ajuste de custo por km exigia caçar
todas as ocorrências. Impossível auditar consistência.

## Decisão

`MetricsService` é o **único** local autorizado a calcular métricas
derivadas. Componentes consomem apenas os métodos públicos declarados
em `docs/architecture/public-api.md`. Utilitários agregadores antigos
foram removidos ou tornaram-se privados ao módulo.

## Alternativas

1. **Hooks React (`useMetrics`)** — bom para cache, mas não substitui a
   necessidade de um domínio único; será construído *sobre* o service.
2. **Selectors por componente** — reintroduz a fragmentação.

## Consequências

- Uma única fórmula de custo/km em produção.
- Testes de métrica ficam centralizados.
- Refactor futuro (memoization, worker) tem uma superfície única.
