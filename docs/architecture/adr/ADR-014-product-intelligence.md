# ADR-014 — Product Intelligence (Sprint 9)

Status: Aceito · Data: 2026-07-27

## Contexto

Após a Sprint 8, o CRM exibia dados agregados (retenção, funil, heatmaps,
cohorts). Faltava a camada que transforma dado em **ação**: quem está em risco,
qual grupo atacar, o que mudar no produto e se a última versão melhorou algo.

## Decisão

Criar `src/lib/services/crmIntelligenceService.ts` — serviço **puro**, específico
do CRM, na mesma posição arquitetural do `crmAnalyticsService`:

```
AdminCRM → useCrm() → crmService → crmRepository → Cloud
                          ├→ crmAnalyticsService   (Sprint 8, puro)
                          └→ crmIntelligenceService (Sprint 9, puro)
```

Entrega:

- **Driver Score (0–100)** — frequência (25), retenção (25), turnos (15),
  corridas (15), metas (10), XP (10). Não é ranking público: existe para
  identificar risco.
- **Churn Prediction** — `100 − score` reforçado por sinais (inatividade ≥ 7d,
  sem Financeiro, sem metas, sem veículo, turno nunca finalizado, onboarding
  incompleto). Cada risco carrega motivos legíveis.
- **Segmentação** — 10 grupos comportamentais (novatos, veteranos, muito ativos,
  risco, usa/não usa GPS, só manual, só Quick Actions, usa/não usa Financeiro).
- **Recomendações automáticas** — cada card exige evidência numérica da base.
- **Feature Adoption** — semana atual × semana anterior por recurso, com delta.
- **Experimentos** — estrutura pronta; `instrumented: false` enquanto a versão
  do app não for persistida por conta. Nenhum número é inventado.
- **Product Health** — índice ponderado só com componentes instrumentados
  (retenção D7 30, finalização de turno 25, GPS 15, sessões 15, abandono 15).
  Crashes entram com peso 0 até existir coleta remota.
- **Customer Journey** — instalou → conta → veículo → turno → corrida → meta →
  voltou → recorrente. "Instalou" é declarado não instrumentado.

## Restrições respeitadas

- Zero alteração em RideService, ShiftService, MetricsService, CloudSync, EventBus.
- Zero alteração de schema: as mesmas colunas já lidas pelo `crmRepository`.
- Zero PII: usuários aparecem como alias determinístico (`Motorista #a1b2`).
- Componentes admin recebem apenas o objeto `CrmIntelligence` por prop.

## Consequências

- `CrmSnapshot` ganha o campo `intelligence` (derivado, sem I/O adicional).
- Para habilitar Experimentos e Crashes basta persistir versão/telemetria por
  conta; o cálculo já está previsto e ligará sem refatoração.
