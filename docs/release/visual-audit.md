# Sprint 7.5 · Fase B — Gate 0 · Visual Audit

Data: 2026-07-23. Sem escrita de código nesta etapa. Baseline para as ondas 1–6.

## 1. Cores hardcoded

**Componentes de app (excluindo `src/components/ui/**` e `src/integrations/**`):**

| Ocorrência | Arquivo | Nota |
| --- | --- | --- |
| `#646cffaa`, `#61dafbaa`, `#888` | `src/App.css` | Legado Vite template. Arquivo não importado pelo app real (`main.tsx` importa apenas `index.css`). **Ação:** remover/limpar `App.css` na Onda 1. |
| `bg-[#000]` | `src/components/SplashScreen.tsx` (l.34) | Preto absoluto intencional (splash AMOLED). **Ação:** trocar por `bg-background` (já é `0 0% 0%`). |
| `#FF6B35`, `#fff` | `src/components/ShiftLiveMap.tsx` (l.87, l.94) | Cores passadas ao Leaflet (`L.polyline`, `L.circleMarker`) — API JS externa, não Tailwind. **Ação:** mover para `hsl(var(--primary))` via `getComputedStyle` ou expor const de tema para Leaflet. Baixa prioridade (só rota GPS). |

**Uso de `bg-black/70`, `bg-white/15` em overlays custom (dialogs manuais):**

- `src/components/BackgroundLocationConsentDialog.tsx`
- `src/components/GpsConsentDialog.tsx`
- `src/components/InstallAppButton.tsx`
- `src/components/RegisterRideFab.tsx`
- `src/components/ShiftMode.tsx` (2×)
- `src/components/PermissionOnboarding.tsx`

Total: **8 overlays** implementados fora do `Dialog`/`Sheet` do shadcn. **Ação Onda 1:** trocar por `bg-background/80 backdrop-blur-sm` (token AMOLED puro) e `bg-card/... ` no card interno; adotar `Sheet` do shadcn onde a UX for a mesma.

## 2. Shadows

- **Nenhuma shadow arbitrária (`shadow-[...]`)** no código de app. ✅
- Todos os componentes já usam `shadow-elevated`, `shadow-premium`, `shadow-glow`, `shadow-glow-sm` (tokens em `index.css`).

## 3. Border radius — distribuição

| Classe | Ocorrências | Status |
| --- | --- | --- |
| `rounded-lg` | 100 | ✅ token `--radius` (14px) |
| `rounded-xl` | 80 | ⚠️ Tailwind default 12px — considerar migrar `rounded-lg`/`rounded-xl` para **um** único radius grande via token |
| `rounded-full` | 51 | ✅ correto para pills/avatars |
| `rounded-md` | 41 | ✅ token `--radius-sm` (10px) |
| `rounded-2xl` | 26 | ⚠️ default 16px — usar em cards Hero |
| `rounded-3xl` / `-t-3xl` | 8 | ❌ **excesso** — bottom-sheets custom. Padronizar em `rounded-t-2xl` |
| `rounded-t-2xl` | 1 | ok |

**Ação Onda 1:** definir escala de 3 radii apenas (`sm=10 / md=14 / lg=20`); mapear `rounded-xl → rounded-lg` em cards; `rounded-3xl → rounded-2xl` em sheets.

## 4. Paddings arbitrários

Somente 4 casos, todos **legítimos** (safe-area iOS/Android):

- `pt-[max(1.25rem,env(safe-area-inset-top))]` — `pages/Index.tsx`
- `pb-[max(1.25rem,env(safe-area-inset-bottom))]` × 2 — `ShiftMode`, `RegisterRideFab`
- `pb-[max(1.5rem,env(safe-area-inset-bottom))]` — `PermissionOnboarding`

**Ação:** unificar para `pb-[max(1.25rem,env(safe-area-inset-bottom))]` — 1.5rem se torna inconsistente.

## 5. Tipografia — `text-[Npx]` arbitrária

240 ocorrências totais, distribuição:

| Tamanho | Uso | Recomendação |
| --- | --- | --- |
| `text-[10px]` | 109 | Criar utilitário `.text-micro` |
| `text-[11px]` | 83 | Criar utilitário `.text-caption` |
| `text-[9px]` | 25 | ⚠️ próximo ao ilegível — auditar e migrar para 10px onde possível |
| `text-[12–15px]` | 15 | Migrar para `text-xs`/`text-sm` (12/14) |
| `text-[42–72px]` | 5 | KPIs grandes — mover para `.kpi-display` no `index.css` |
| `text-[17px]` | 2 | Migrar para `text-base` (16) ou `text-lg` (18) |

**Ação Onda 1:** criar 4 utilitários semânticos e migrar em massa via find/replace controlado por onda (Dashboard → Perfil → Financeiro → Histórico).

## 6. Font weights — distribuição

| Weight | Uso | Nota |
| --- | --- | --- |
| `font-semibold` | 193 | ✅ padrão |
| `font-bold` | 149 | ✅ enfâse |
| `font-medium` | 21 | ✅ labels |
| `font-normal` | 8 | ok (limpar redundância com defaults) |
| `font-black` | 1 | ❌ isolado — remover |

Escala aprovada: **medium / semibold / bold** (mais `regular` implícito).

## 7. Animações — inventário

Em `src/index.css`:

- `pulse-dot`, `pulse-glow`, `fab-pop`, `kpi-flash`, `fade-in-up`, `splash-in`.

Em `tailwind.config.ts`:

- `accordion-down/up`, `slide-up`, `fade-in`.

Duplicidades:
- `fade-in` (tailwind, 240ms) vs `fade-in-up` (css, 240ms) — **overlap**. Definir 1 canônico por eixo (fade puro vs fade+lift).
- Nenhuma animação > 620ms (splash) — todas dentro de 250ms alvo. ✅

**Ação Onda 1:** adicionar `count-up`, `bar-fill`, `glow-pulse` para KPIs, meta e hero card.

## 8. Componentes shadcn

**48 primitives** disponíveis. Variants custom encontrados:

- **Button:** 6 variants (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) + 4 sizes — completo.
- **Card:** sem variants — só `rounded-lg + bg-card + shadow-elevated`. **Ação:** adicionar variants `premium`, `glass`, `highlight` no `card.tsx` para que Dashboard/Financeiro/Perfil consumam `<Card variant="premium">` em vez de className manual.
- **Badge:** 4 variants — **falta `success`, `warning`, `info`, `pro`**. **Ação:** estender.
- **Progress:** default — sem indicador circular. **Ação:** criar `<ProgressWithDot />` local ou variant.

## 9. Dialogs / Overlays

6 componentes com overlay manual em vez do `Dialog`/`Sheet` shadcn (ver §1). Adicionalmente `RegisterRideFab` e `ShiftMode` implementam bottom-sheets custom com `rounded-t-3xl + max-h-[92vh]`.

**Ação Onda 1:** criar utilitário `.overlay-scrim` (`fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-fade-in`) e substituir em todos.

## 10. Cores hardcoded já removidas (baseline positivo)

- Zero `text-white`, `bg-white`, `text-slate-*`, `bg-gray-*` em componentes de app. ✅
- Todos os componentes já usam semantic tokens (`text-foreground`, `bg-card`, `text-muted-foreground`, `bg-secondary`, `text-primary-foreground`, etc). ✅
- Sistema de tokens `--profit / --loss / --info / --warning / --destructive` já existe. ✅

## Conclusão do Gate 0

Estado geral: **muito saudável**. As inconsistências são localizadas e resolvíveis via Design System — não exigem edição componente a componente.

### Backlog congelado para as ondas seguintes

**Onda 1 (Fundação):**
1. Remover `src/App.css` (legado).
2. Trocar `bg-[#000]` do `SplashScreen` por `bg-background`.
3. Extrair cor do polyline Leaflet para computed style de `--primary`.
4. Utilitários tipográficos: `.text-micro (10px)`, `.text-caption (11px)`, `.kpi-display`.
5. Utilitário `.overlay-scrim`.
6. Escala de radius: mapear `rounded-3xl → -2xl`; unificar safe-area padding.
7. Variants novos: `Card variant="premium|glass|highlight"`, `Badge variant="success|warning|info|pro"`.
8. Keyframes novos: `count-up`, `bar-fill`, `glow-pulse`.
9. Remover `font-black`.

**Ondas 2–5:** consumir novos variants/utilitários em Dashboard, Nav, Financeiro, Histórico, Perfil, Conquistas — sem className duplicada.

**Onda 6:** re-rodar este audit; qualquer nova entrada nas tabelas §1–§6 é regressão.

### Métrica de sucesso

Após Onda 6, o mesmo audit deve mostrar:

- `text-[Npx]` ≤ 20 ocorrências (só KPIs display).
- `rounded-3xl` = 0.
- `font-black` = 0.
- Overlays manuais = 0.
- Cores hardcoded em componentes = 0 (Leaflet exposto via CSS var).
