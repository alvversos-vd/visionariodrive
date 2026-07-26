# Sprint 7.5 · Fase B — Gate 0 · Visual Audit

Data: 2026-07-23. Baseline para as ondas 1–6. Atualizado ao fim da Onda 1 (2026-07-23).

## 1. Cores hardcoded

**Componentes de app (excluindo `src/components/ui/**` e `src/integrations/**`):**

| Ocorrência | Arquivo | Status Onda 1 |
| --- | --- | --- |
| `#646cffaa`, `#61dafbaa`, `#888` | `src/App.css` | ✅ **Removido** — arquivo legado deletado. |
| `bg-[#000]` | `src/components/SplashScreen.tsx` | ✅ **Migrado** para `bg-background` (AMOLED). |
| `#FF6B35`, `#fff` | `src/components/ShiftLiveMap.tsx` | ✅ **Migrado** para `hsl(var(--map-route-color))` e `hsl(var(--map-route-contrast))`. Ver §11. |

**Overlays manuais (`bg-black/70`):** todos migrados para o utilitário `.overlay-scrim`
(`BackgroundLocationConsentDialog`, `GpsConsentDialog`, `RegisterRideFab`, `ShiftMode` ×2).
Onboarding e Install já usam surface própria — sem regressão.

## 2. Shadows

- Nenhuma shadow arbitrária. ✅ (mantido)

## 3. Border radius — distribuição

- `rounded-3xl` e `rounded-t-3xl` → **0** (bottom-sheets padronizados em `rounded-t-2xl`). ✅
- Escala oficial: `sm=10px` (`--radius-sm`) / `md=14px` (`--radius`) / `lg=20px` (`--radius-lg`).
- `rounded-xl` / `rounded-2xl` ainda usados extensivamente — permitido (defaults Tailwind alinhados à escala).

## 4. Paddings arbitrários (safe-area)

- Unificado em `pb-[max(1.25rem,env(safe-area-inset-bottom))]` (`RegisterRideFab`, `PermissionOnboarding`, `ShiftMode`). ✅

## 5. Tipografia — utilitários aprovados

Novos utilitários em `src/index.css`:

- `.text-micro` — 10px.
- `.text-caption` — 11px.
- `.kpi-display` — display display font, tabular, letter-spacing -0.03em.

Ainda restam ocorrências de `text-[Npx]` em componentes de app; a migração ocorre nas ondas 2–5 (Dashboard → Perfil → Financeiro → Histórico), consumindo os utilitários. A checklist em `scripts/design-system-check.sh` permite apenas `text-[Npx]` com N ≥ 32 (KPIs display).

## 6. Font weights

- `font-black` → **0**. ✅ (substituído por `font-bold` em `PermissionOnboarding`.)
- Escala oficial: `medium / semibold / bold`.

## 7. Animações — inventário

Adicionadas nesta onda em `src/index.css`:

- `count-up` (240ms · KPIs) — `.animate-count-up`
- `bar-fill` (600ms · progress/metas) — `.animate-bar-fill`
- `glow-pulse` (2.4s · hero card / status ao vivo) — `.animate-glow-pulse`

Todas dentro do orçamento de 250ms para microinteração (exceto `bar-fill` intencional e `glow-pulse` looping).

## 8. Componentes shadcn — variants novos

- **`Card`** (`src/components/ui/card.tsx`): variants `default | premium | glass | highlight`. Componentes de feature devem consumir `<Card variant="premium">` em vez de className manual.
- **`Badge`** (`src/components/ui/badge.tsx`): variants `success | warning | info | pro`.

Consumo será feito nas ondas 2–5. Não introduzimos className duplicada nesta onda.

## 9. Dialogs / Overlays

- Utilitário `.overlay-scrim` publicado em `src/index.css` (fixed inset-0 · `bg-background/80` · `backdrop-blur` · `animate-fade-in-up 200ms`).
- Todos os 5 overlays manuais migrados. Onboarding e Install permanecem com surface própria por design.

## 10. Cores hardcoded já removidas (baseline positivo)

Mantido — zero regressões detectadas.

## 11. Exceção documentada — Cor da rota GPS

`ShiftLiveMap.tsx` desenha a rota via API JS do Leaflet (`L.polyline`, `L.circleMarker`), fora do pipeline Tailwind. A cor **não** representa a identidade visual da marca (verde Visionário), e sim uma cor semântica de visualização cartográfica.

**Decisão:** manter uma cor distinta da marca, mas expor via token:

- `--map-route-color: 16 100% 60%` (laranja alto contraste sobre tiles claros/escuros).
- `--map-route-contrast: 210 20% 96%` (halo/traço do marker).

Leitura via `getComputedStyle(document.documentElement).getPropertyValue(...)` no efeito de render do mapa. Trocar a cor da rota agora é 1 linha em `src/index.css` — sem tocar em componente.

## 12. Governança adicionada nesta onda (regras do CTO)

1. **Componentes de feature não definem aparência base.**
   Nenhum novo componente pode nascer com `rounded-*`, `shadow-*`, `bg-card`, `bg-secondary`, `text-foreground` no primeiro `<div>` "wrapper" — deve usar `<Card variant="…">`, `.card-premium`, `.card-glass`, `.overlay-scrim`, etc. Aparência base vem do Design System.
2. **Checklist automática ao fim de cada onda.**
   `scripts/design-system-check.sh` valida:
   - `font-black` = 0
   - `rounded-3xl` / `rounded-t-3xl` = 0
   - `bg-black/70` = 0
   - `text-[Npx]` só permitido para N ≥ 32 (KPIs display)
   - `#hex` = 0 fora de `src/components/ui/**` e `src/integrations/**`
   Rodar em conjunto com `tsgo`, `eslint` e `vitest`.

## Conclusão do Gate 0

Estado geral: **muito saudável**. Onda 1 concluída — fundação pronta para as ondas 2–5.

### Onda 1 — Concluída ✅

1. ✅ Removido `src/App.css` (legado Vite template).
2. ✅ Splash migrado para `bg-background` + `rounded-2xl`.
3. ✅ Leaflet migrado para token `--map-route-color` (exceção documentada em §11).
4. ✅ Utilitários tipográficos: `.text-micro`, `.text-caption`, `.kpi-display`.
5. ✅ Utilitário `.overlay-scrim` + 5 dialogs migrados.
6. ✅ Escala de radius: `rounded-3xl → rounded-2xl`; safe-area unificado.
7. ✅ `Card variant="premium|glass|highlight"`; `Badge variant="success|warning|info|pro"`.
8. ✅ Keyframes: `count-up`, `bar-fill`, `glow-pulse`.
9. ✅ `font-black` removido.
10. ✅ Checklist automática: `scripts/design-system-check.sh`.

### Onda 6 — Consistência final ✅ (2026-07-26)

- 195 ocorrências de `text-[Npx]` migradas: `9/10px → .text-micro`, `11px → .text-caption`, `12px → text-xs`, `13/14px → text-sm`.
- Whitelist final: `text-[Npx]` permitido apenas para N ≥ 15 (títulos/KPIs display).
- `scripts/design-system-check.sh`: tipografia e hex promovidos de SOFT para **HARD**. Zero warnings.

### Métrica de sucesso — final

- `text-[Npx]` fora da whitelist = 0 ✅
- `rounded-3xl` = 0 ✅
- `font-black` = 0 ✅
- Overlays manuais com `bg-black/70` = 0 ✅
- Cores hardcoded em componentes = 0 ✅ (Leaflet via CSS var)

**Sprint 7.5 · Fase B encerrada.** Design System sob governança automática (todos os checks HARD).
