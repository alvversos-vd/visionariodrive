# ADR-011 — Módulo de Gamificação Concluído

- **Status:** Aceito (Sprint 6.3)
- **Sucessor de:** ADR-009 (design), ADR-010 (cloud sync)

## Contexto

Sprint 6.2 entregou XP + conquistas com sync (ADR-010). Sprint 6.3 fecha a
experiência do motorista com Perfil Inteligente expandido, histórico completo,
celebração de nível e evolução visual — sem introduzir novo storage
sincronizado.

## Decisão

1. **Owner único mantido:** `xpService`, `achievementService` e
   `gamificationRepository` continuam sendo a única fonte de verdade
   sincronizada. Perfil e modais consomem apenas Services.
2. **Buckets locais não-sincronizados** (`vd-xp-daily-v1`, `vd-xp-weekly-v1`)
   ficam encapsulados dentro de `xpService`. Justificativa: são
   derivados/UX — recomputáveis a partir dos eventos do bus e não valem custo
   de reconciliação multi-device.
3. **StatsContext extensível:** ganhou campos derivados (`bestDailyEarned`,
   `longestShiftMinutes`, `daysUsingApp`, `xpEarnedToday`, `totalXp`) usados
   pela UI. Condições de conquistas continuam usando apenas os campos
   originais — extras não desbloqueiam nada.
4. **LevelUpModal** escuta `level-up` via bus e é montado uma única vez em
   `App.tsx`. Suprime bootstrap para não disparar em recarga com sessão
   existente.

## Alternativas descartadas

- **Persistir XP diário/semanal em `user_data`:** custo alto por dado
  puramente estatístico e reconstruível.
- **Introduzir novo evento `xp:daily-reset`:** o serviço detecta virada de dia
  no `earnedToday()` de forma preguiçosa. Um evento adicionaria complexidade
  sem benefício.

## Consequências

- Perfil Inteligente e histórico funcionam offline e sem depender de rede.
- `xpService.reset()` limpa também os buckets locais para não vazar dados
  entre contas.
- Telemetria ganhou 3 contadores de UI (`achievement_view`,
  `achievement_details`, `levelup_modal`) sem PII.

## Exceção arquitetural

`MyEvolutionChart` renderiza dados vindos exclusivamente de `xpService`
(Service), respeitando a ADR-004.

## Escopo intencionalmente removido

- Painel operacional na notificação Android com actions nativas
  (Registrar / Finalizar / Confirmar). Requer plugin Capacitor Java e
  reabertura de `security-audit`, `play-store-checklist` e LGPD.
  **Movido para Sprint 7** — ver `roadmap.md`.
