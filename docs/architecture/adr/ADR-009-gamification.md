# ADR-009 — Gamificação, CRM e Indicações (Sprint 6)

- **Status:** Em vigor a partir de Sprint 6 · Fase 1 (2026-07-14)
- **Contexto:** Release Freeze v1.0.0 encerrado. Sprint 6 introduz CRM administrativo, sistema de XP/conquistas e indicações **sem alterar** a arquitetura Start.

## Decisão

1. **Toda nova capacidade segue o padrão de camadas oficial:**
   `Component → Hook → Service → Repository → Supabase`.
   Nenhum componente importa Repository ou o client Supabase (exceto Auth).

2. **Owners únicos** — cada entidade nova tem um único Repository:
   | Entidade | Owner | Tabela |
   |----------|-------|--------|
   | Role de acesso | `user_roles` (Postgres) via `has_role()` | `public.user_roles` |
   | Snapshot CRM (agregado, não persistido) | `crmRepository` | leitura de `profiles` + `user_data` |
   | XP/Conquistas (Fase 2) | reservado — `achievementRepository`, `xpRepository` | a definir |
   | Indicações (Fase 3) | reservado — `inviteRepository` | a definir |

3. **Controle de acesso admin** = tabela `user_roles` + função `has_role()` SECURITY DEFINER.
   - Padrão oficial Lovable (evita recursão de RLS).
   - `has_role` é executável apenas por `authenticated` e `service_role`; `PUBLIC`/`anon` revogados.
   - Warning `0029_authenticated_security_definer_function_executable` do linter é aceito por design.

4. **EventBus estendido** com eventos novos (`crm:changed`, `xp:changed`, `achievement:unlocked`, `profile:changed`, `invite:changed`).
   Regras herdadas: nenhum componente publica eventos; nenhum evento carrega payload; sem PII.

5. **Nenhuma feature de Sprint 6 pode**:
   - alterar API pública existente,
   - duplicar owner de entidade,
   - introduzir polling ou `setInterval` para dados reativos,
   - vazar PII em telemetria,
   - quebrar Start (Turno, GPS, Offline, Cloud Sync, Ride Detection).

## Consequências

- Baseline Start v1.0.0 preservada; novas features vivem sobre a mesma fundação.
- CRM depende de policies admin em `profiles`/`user_data` (SELECT-only). Nenhum admin escreve em dados de usuários.
- Gamificação e Indicações (Fases 2/3) devem seguir estritamente esta ADR — qualquer desvio requer nova ADR.
