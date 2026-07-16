# Sprint 6 — CRM + Perfil + Conquistas + Indicações

> Sprint iniciada em 2026-07-14 após encerramento oficial do Release Freeze v1.0.0
> (que permanece como baseline de produção). Arquitetura, APIs públicas, GPS,
> Offline Sync e Cloud Sync **inalterados**.

---

## Fase 1 — CRM Analytics ✅

### Escopo entregue

- **Controle de acesso admin** via tabela `user_roles` + enum `app_role` + função `has_role(uuid, app_role)` (SECURITY DEFINER, padrão Lovable). RLS scoped a `auth.uid()` e `has_role`.
- **Policies admin de leitura** em `profiles` e `user_data` (SELECT-only). Nenhuma escrita liberada.
- **Camada de dados**
  - `src/lib/repositories/crmRepository.ts` — único owner das leituras admin.
  - `src/lib/services/crmService.ts` — única API pública. Agrega KPIs, série 30d, distribuição horária. Sem PII.
  - `src/hooks/useCrm.ts` — hook reativo (useBusVersion + `crm:changed`).
  - `src/hooks/useIsAdmin.ts` — checa role do usuário atual.
- **UI**
  - `src/pages/AdminCRM.tsx` em rota `/admin` (protegida por `ProtectedRoute` + `useIsAdmin`). Redireciona não-admin para `/`.
  - Cards KPI (usuários, ativos 1d/7d/30d, novos, PRO, onboarding %, turnos, corridas, GPS auto %, km, lucro).
  - Gráfico `LineChart` de novos vs ativos (30d).
  - `BarChart` de corridas por hora do dia.
- **EventBus** estendido com `crm:changed`, `xp:changed`, `achievement:unlocked`, `profile:changed`, `invite:changed` (reservados para Fases 2/3).

### Arquitetura preservada

```
AdminCRM (Component) → useCrm (Hook) → crmService (Service) → crmRepository (Repository) → Supabase
```

Zero acesso direto de Component a Repository ou Supabase (fora do padrão Auth já documentado).

### Segurança

- Warning `0029_authenticated_security_definer_function_executable` do linter é **aceito** para `has_role`: precisa ser executável por `authenticated` para as próprias RLS policies chamarem sem recursão infinita — padrão oficial Lovable. `EXECUTE` revogado de `PUBLIC` e `anon`.
- Nenhum e-mail, ID Supabase, coordenada ou valor por usuário aparece no CRM. Apenas contagens e médias.

### Como promover um admin

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<seu-user-id>', 'admin');
```

O primeiro admin deve ser inserido manualmente. A rota `/admin` fica inacessível até isso.

### Checklist de aceite Fase 1

- [x] Zero acesso direto ao Repository em Components.
- [x] Typecheck verde.
- [x] EventBus reativo (`crm:changed`), sem polling.
- [x] CRM refletindo dados reais do banco (via RLS admin).
- [x] Arquitetura Start preservada.
- [x] Documentação da fase.

---

## Fase 2 — Conquistas + Perfil Inteligente + XP ✅

Entregue em 2026-07-15. Ver commits de `src/lib/gamification/*`, `src/lib/services/xpService.ts`,
`achievementService.ts`, `useXp`/`useAchievements`, `ProfileGamificationCard`, `AchievementToast`.
Persistência 100% local (localStorage) — pronta para receber cloud sync na Sprint 6.2.5.

## Sprint 6.2.5 — Cloud Sync da Gamificação ✅

Objetivo: tornar XP + Conquistas persistentes entre dispositivos SEM criar novos owners,
services, tabelas ou pipelines de sync.

### Entregas

- **Migração:** coluna `user_data.gamification` (jsonb) — reutiliza RLS existentes.
- **Novo owner único:** `gamificationRepository` (`vd-gamification`, schemaVersion 1) com
  payload `{ xp, achievements, stats, updatedAt }`.
- **`xpRepository` e `achievementRepository`** viram adapters finos — APIs públicas
  100% preservadas.
- **CloudSync (`src/lib/cloudSync.ts`)** ganhou:
  - mapeamento `'vd-gamification' → 'gamification'` em `KEY_MAP`,
  - branch dedicada em `mergeIncomingForKey` que delega a `mergeGamification`,
  - notificação `notifyGamificationApplied` disparada apenas em hydrate/realtime
    (evita ruído em pushes idempotentes).
- **EventBus:** `gamification:synced` (após push) e `gamification:merged` (após merge de cloud).
- **Telemetria:** contadores `gamification_sync`, `gamification_merge`, `gamification_conflict` (sem PII).
- **Registro de reset:** `vd-gamification` adicionado ao `APP_STORAGE_KEYS`.
- **Snapshot de stats** atualizado automaticamente pelo `achievementService.evaluate`.
- **ADR-010** publicada.

### Estratégia de merge (determinística)

| Campo | Regra |
|-------|-------|
| `xp.totalXp` | máximo (nunca reduz) |
| `achievements` | união por id, `unlockedAt` mais antigo prevalece |
| `stats.*` | máximo campo a campo |
| `updatedAt` | ISO mais recente |
| `level` | recalculado a partir de `totalXp` (nunca persistido isolado) |

### Testes (`gamificationRepository.test.ts`)

- primeiro sync (payload vazio → default)
- write/read com updatedAt
- schemaVersion + payload inválido (fallback default)
- retrocompatibilidade com JSON parcial
- reset
- merge XP (máximo, nunca reduz)
- merge achievements (união + preserva unlockedAt antigo, nunca remove)
- merge stats (máximo por campo)
- merge updatedAt (mais recente)
- hadConflict true/false
- cenários troca de aparelho, reinstalação, offline→online

### Checklist de aceite

- [x] Typecheck verde.
- [x] Nenhuma API pública de xp/achievement service ou repository alterada.
- [x] Nenhum sincronizador paralelo.
- [x] Nenhuma tabela nova.
- [x] Offline continua funcionando (mesmo pipeline `markDirty`).
- [x] Merge determinístico coberto por testes.
- [x] Health Score preservado (≥ 9.9 mantido; alvo 9.95 no fechamento da Fase 3).

## Fase 3 — Indicações

Status: **pendente** — inicia após confirmação de Sprint 6.2.5.

