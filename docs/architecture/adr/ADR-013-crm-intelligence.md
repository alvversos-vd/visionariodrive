# ADR-013 — CRM Intelligence (Sprint 8)

Status: aceito · 2026-07-26

## Contexto

O CRM (Sprint 6) entregava apenas KPIs descritivos. Faltavam retenção, funil,
cohorts e sinais acionáveis para priorizar o roadmap antes do PRO.

## Decisão

1. **Nenhuma alteração** em `RideService`, `ShiftService`, `MetricsService`,
   `CloudSync` ou `EventBus`. Sprint 8 é aditiva e isolada no domínio CRM.
2. Novo serviço **puro** `crmAnalyticsService` (sem I/O): recebe as linhas lidas
   pelo `crmRepository` e deriva retenção, funil, heatmaps, uso de features,
   cohorts, saúde, ranking de conquistas, painel financeiro, alertas e roadmap.
3. `crmService` continua sendo a **única** API pública: `loadSnapshot()` passa a
   devolver `snapshot.analytics`. Componentes consomem só via `useCrm()`.
4. `crmRepository` ganhou colunas agregáveis (`vehicles_v2`, `financial`,
   `gamification`, `goals`, `created_at`). Nenhuma tabela ou coluna nova no banco.
5. Painéis em `src/components/admin/CrmPanels.tsx` — apresentação pura.

## Fluxo

```text
AdminCRM → useCrm() → crmService → crmAnalyticsService (puro)
                              ↘ crmRepository → Supabase (RLS admin)
```

## Honestidade de dados

Métricas sem instrumentação remota não são inventadas. A telemetria de GPS,
notificações, Quick Actions e plataforma é **local ao device** (ring buffer), então
essas áreas aparecem como `unknown` / "sem instrumentação" no painel de saúde, e o
painel financeiro expõe `instrumented: false` até existir billing. Instalações não
são rastreadas — o funil começa na criação de conta.

## Consequências

- Zero risco para o núcleo de tracking; nenhuma escrita nova.
- Próximo passo natural: pipeline de telemetria agregada (opt-in, sem PII) para
  fechar as lacunas `unknown` das Fases 4 e 6.
