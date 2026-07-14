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

## Fase 2 — Conquistas + Perfil Inteligente + XP

Status: **pendente** — inicia após confirmação da Fase 1.

## Fase 3 — Indicações

Status: **pendente** — inicia após conclusão da Fase 2.
