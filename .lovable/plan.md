## Plano — Estrutura jurídica + ajustes GPS

### 1. GPS — toast explicativo antes da permissão
Em `src/components/ShiftMode.tsx`, na função `requestGpsPermission`:
- Mostrar primeiro um toast informativo: *"Sua localização será utilizada apenas durante turnos ativos para cálculo de distância e desempenho."*
- Aguardar ~800ms e então chamar `getCurrentPosition`.
- Em caso de falha/negação, já existe o fallback manual; garantir persistência salvando flag `gps_status: 'denied' | 'unavailable' | 'ok'` no shift ativo (em `src/lib/shifts.ts`) para que o histórico registre que o turno usou modo manual — sem quebrar cálculos (mantém `Math.max(km_corridas, km_gps)`).

### 2. Documentos jurídicos (LGPD)
Criar página única `src/pages/Legal.tsx` com rotas via query/hash para 4 seções:
- Termos de Uso
- Política de Privacidade
- Política de Localização
- Como excluir minha conta

Rota pública `/legal` (acessível antes do login). Conteúdo redigido conforme o briefing — linguagem clara, sem promessas de lucro, cobrindo: app como ferramenta auxiliar, cálculos estimativos, limitação de responsabilidade, dados coletados (sem CPF/RG), uso de localização apenas em turno ativo, não compartilhamento, direitos do titular, segurança.

Adicionar links no rodapé de `src/pages/Auth.tsx` e em `src/components/ProfileView.tsx`.

### 3. Consentimento no cadastro
Em `src/pages/Auth.tsx` (modo signup):
- Checkbox obrigatório "Li e aceito os Termos de Uso e Política de Privacidade" com links.
- Bloquear submit sem aceite.
- Salvar `termos_aceitos_em` (timestamp ISO) e `termos_versao` ("1.0") em `raw_user_meta_data` no `signUp`.
- Atualizar `handle_new_user()` (migração) para persistir esses campos na `profiles` (novas colunas `termos_aceitos_em timestamptz`, `termos_versao text`).

### 4. Exclusão de conta
Em `src/components/ProfileView.tsx`:
- Botão "Excluir minha conta" com dialog de confirmação que exige reconfirmação de senha (reautenticação via `signInWithPassword`).
- Edge function `delete-account` (com `SUPABASE_SERVICE_ROLE_KEY`) que: apaga `user_data`, `profiles` e chama `auth.admin.deleteUser(user.id)`.
- Após sucesso: `signOut` e redirect para `/auth`.

### 5. Migração de banco
```text
ALTER TABLE profiles
  ADD COLUMN termos_aceitos_em timestamptz,
  ADD COLUMN termos_versao text;
```
Atualizar `handle_new_user()` para ler de `raw_user_meta_data`.

### 6. Segurança / housekeeping
- Validações zod já presentes em Auth — manter.
- Tokens permanecem em `localStorage` do supabase-js (padrão) — documentar na política.
- Nenhuma alteração em RLS (já corretas).

### Arquivos
- editar: `src/components/ShiftMode.tsx`, `src/lib/shifts.ts`, `src/pages/Auth.tsx`, `src/App.tsx` (rota `/legal`), `src/components/ProfileView.tsx`
- criar: `src/pages/Legal.tsx`, `supabase/functions/delete-account/index.ts`
- migração: colunas em `profiles` + update da função `handle_new_user`

Confirmar para eu prosseguir?