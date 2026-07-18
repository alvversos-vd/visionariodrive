# Technical Roadmap — Pós Sprint 6

> **Release Freeze v1.0.0 encerrado em 2026-07-14.** v1.0.0 permanece como baseline de produção.
> Sprint 6 em andamento sobre a mesma arquitetura — ver `docs/release/sprint-6.md` e `docs/architecture/adr/ADR-009-gamification.md`.

---

## Sprint 3 — Ativação da Fundação ✅ CONCLUÍDA

| Item | Status |
|------|--------|
| Hooks `useRides` / `useMetrics` / `useFinancial` / `useShift` / `useDashboard` | ✅ |
| Migrar Shift/GPS para Services (`shiftService`, encerra DBT-L1) | ✅ ADR-007 |
| Telemetria one-shot (`telemetry.recordMigration`) | ✅ |
| Insights v1 (`metricsService.insights`, máx. 3) + `InsightsCard` | ✅ |
| `eventBus` reativo (`rides:changed`, `financial:changed`, `shift:changed`) | ✅ |

## Sprint 4 — Expansão ✅ CONCLUÍDA

| Item | Status |
|------|--------|
| GPS automático de corridas (`rideDetectionService`) | ✅ ADR-008 |
| Bulk export/import RideModel | ✅ |
| Remover coluna `shifts.rides` | ⚠ postergado — Sprint 6 |

## Sprint 5 — Estabilização Release Candidate ✅ CONCLUÍDA

| Sprint | Escopo | Status |
|--------|--------|--------|
| 5.1 | Zero Warning Gate | ✅ |
| 5.2 | Robustness Audit | ✅ |
| 5.3 | UX Review (motorista real) | ✅ |
| 5.4 | Security & LGPD Audit | ✅ |
| 5.5 | Performance & RC1 (lazy loading) | ✅ |
| 5.6 | GO / NO-GO Review — **GO** | ✅ |

---

## Sprint 6 — Pós-Beta (planejada, congelada até fim do Freeze)

| Item | Objetivo | Origem | Prioridade |
|------|----------|--------|------------|
| Resolver 16 warnings `react-refresh/only-export-components` | Cleanup lint | Sprint 5.1 | Média |
| Remover coluna legada `shifts.rides` | Encerrar DBT-M2 | Sprint 4 | Média |
| Remover `ensureMigratedFromLegacy` | Encerrar DBT-M1 | Sprint 5 | Média |
| Documentar `remove()` para 5 listeners singleton | Robustness (R-002..R-006) | Sprint 5.2 | Baixa |
| Consolidar feedback P2 do Beta | Backlog reativo | `beta-feedback.md` | Alta |

## Sprint 6.3 — Finalização da Gamificação ✅ CONCLUÍDA

| Item | Status |
|------|--------|
| Perfil Inteligente expandido (10 stats, XP hoje, dias no app) | ✅ |
| `AchievementsModal` (histórico completo + progresso) | ✅ |
| `LevelUpModal` reativo em `level-up` | ✅ |
| `xpService.earnedToday()` + `weeklySeries()` (localStorage) | ✅ |
| Gráfico `MyEvolutionChart` (Recharts, sem sync) | ✅ |
| Novas conquistas (`visionary_shifts`) + relabel (streak_30, rides_500) | ✅ |
| Telemetria: `achievement_view`, `achievement_details`, `levelup_modal` | ✅ |
| ADR-011 (Gamification Module Completed) | ✅ |

## Sprint 7 — Driver Quick Actions Nativas (Android)

**Escopo removido da Sprint 6.3 por conflito com Release Freeze e ausência de plugin Capacitor nativo.**

| Item | Objetivo | Dependência | Prioridade |
|------|----------|-------------|------------|
| Plugin Capacitor Java (`VisionarioNotificationsPlugin`) | Foreground Service com `NotificationCompat.Action` (Registrar / Finalizar / Confirmar Auto) e `BroadcastReceiver` → `notifyListeners` | Nova infra nativa | Alta |
| `notificationActionService` (TS) | Recebe ações do plugin e chama `RideService`/`ShiftService` | Plugin acima | Alta |
| Painel enriquecido (km/lucro/corridas do turno) | Reagir ao bus, sem polling | EventBus | Alta |
| Deep-links `/quick/register` e `/quick/end-shift` | Fallback PWA e device com WebView morta | Router | Média |
| Reabertura de `security-audit`, `play-store-checklist`, `LGPD` | Nova permissão `FOREGROUND_SERVICE_LOCATION` + notificação persistente | Sprint 7.x | Alta |
| Teste em device físico (Android 10..15) | Regressão de tracking | QA | Alta |

## Sprint 8 — Consolidação Arquitetural (renumerado)

| Item | Objetivo | Prioridade |
|------|----------|------------|
| CI de arquitetura (checklist como gate) | Governança | Alta |
| Web Worker p/ metrics | Sair da main thread | Média |
| Bulk import RideModel com validação de esquema | Backup robusto | Média |

## Plano PRO (Fase 3+)

| Item | Dependências | Risco |
|------|--------------|-------|
| IA de insights avançados (LLM sobre RideModel) | AI Gateway | Alto |
| Comparativos entre motoristas | Telemetria opt-in, LGPD | Alto |
| Previsão de ganhos | `metricsService` | Médio |
| Antifraude estrutural | RideModel completo | Alto |
| Gamificação / badges / streaks visuais | UX PRO | Médio |
| Heatmap de zonas de alta demanda | GPS agregado anonimizado | Alto |
| Barra de notificação persistente Android | Foreground service dedicado | Médio |
| Dashboards avançados (semana/mês/ano) | MetricsService puro | Médio |

## Futuro (sem sprint alocada)

- iOS build (Capacitor iOS)
- Multi-idioma (i18n)
- Integração bancária (Open Finance) — apenas leitura
- Modo frota (multi-motorista, PRO Empresa)
- Comparativo entre apps (Uber / 99 / iFood) — sem scraping

---

## Princípios de priorização

1. Nenhuma feature PRO pode quebrar START.
2. Nenhuma feature nova pode introduzir owner duplicado.
3. Toda mudança em API pública requer ADR.
4. Débitos M/A bloqueiam features que dependem deles.
5. **Durante Release Freeze:** somente Crash / P0 / P1 / LGPD / Segurança / Play Store.
