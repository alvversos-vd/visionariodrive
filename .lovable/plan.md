# Sprint Visual — Visionário Drive Premium

Sprint **100% visual**. Sem mexer em regras de negócio, GPS, tracking, auth, banco ou arquitetura. Apenas tokens, componentes e refino de telas existentes.

## 1. Leitura da marca (logo)

A logo entrega 4 sinais que viram a base do sistema:

- **Verde neon (mint glow)** sobre **preto carbono** — tecnologia + precisão
- **Anel orbital** ao redor do "V" — movimento, GPS, rastreamento
- **Pin de localização** integrado — operação real do motorista
- **Acabamento metálico do aro** — sofisticação, "instrumento profissional"

Tradução em design: dark mode nativo, grafite em camadas, verde usado com parcimônia como "sinal vivo" (turno ativo, GPS, ação primária), tipografia técnica, geometria limpa.

## 2. Design Tokens (index.css + tailwind.config.ts)

### Paleta (HSL, dark-first)

```text
Brand
  --brand-primary       142 72% 58%   (verde Visionário, derivado da logo)
  --brand-primary-glow  142 90% 68%
  --brand-primary-deep  148 55% 32%

Surfaces (grafite em camadas — NUNCA #000 absoluto)
  --bg-base       222 18% 6%      fundo app
  --bg-elevated   222 16% 9%      cards
  --bg-overlay    222 14% 12%     bottom sheets / modais
  --bg-inset      222 20% 4%      inputs / wells

Linhas / divisores
  --border-subtle 222 12% 16%
  --border-strong 222 14% 22%
  --ring          142 72% 58%

Texto
  --fg-primary    210 20% 96%
  --fg-secondary  215 14% 70%
  --fg-muted      218 10% 50%
  --fg-onBrand    222 30% 6%

Status (alinhados ao tom da marca, sem cores genéricas)
  --success 142 72% 58%   (mesma família da brand)
  --warning  38 92% 60%
  --danger    0 78% 62%
  --info    198 85% 60%
```

### Gradientes & efeitos
```text
--gradient-brand      linear 135deg, primary → primary-glow
--gradient-surface    linear 180deg, bg-elevated → bg-base
--glow-brand-sm       0 0 16px hsl(brand / .35)
--glow-brand-md       0 0 28px hsl(brand / .45)
--shadow-elevated     0 1px 0 hsl(border-subtle), 0 8px 24px hsl(0 0% 0% / .4)
```
Profundidade vem de contraste de superfície + 1px hairline, **não** de sombras flutuantes.

### Tipografia
- Display/KPIs: **Space Grotesk** (técnica, geométrica)
- Texto: **Inter** (mantém leitura, já no projeto)
- Mono (números financeiros tabulares): **JetBrains Mono** com `font-variant-numeric: tabular-nums`

Escala: `display 32 / h1 24 / h2 20 / h3 17 / body 15 / label 13 / caption 11`. Pesos: 600 para títulos/KPIs, 500 para labels, 400 para corpo.

### Espaçamento & raio
- Spacing scale única: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48
- Raio único: `--radius: 14px` (cards/sheets), `10px` (inputs/buttons), `999px` (pills)
- Safe-area iOS respeitada em todos containers full-bleed

### Glow rule
Glow verde **só** em: turno ativo, GPS ativo, badge operacional 🟢, botão primário em estado pressed/loading, ring de foco. Nunca decorativo.

## 3. Componentes (shadcn variants — sem refazer API)

Refino via `class-variance-authority` + tokens novos. Sem novos componentes, sem novas libs.

- **Button**: variantes `primary` (gradient brand + glow no hover), `secondary` (bg-elevated + border-subtle), `ghost`, `danger`. Altura 44 mobile / 40 desktop. Pressed state com scale 0.98.
- **Card**: bg-elevated, border hairline, raio 14, sem shadow flutuante; variante `kpi` com number em mono + label uppercase tracking-wide.
- **Input/Select/Switch**: bg-inset, border-subtle, focus-ring brand.
- **Bottom Sheet / Dialog**: bg-overlay, drag handle, raio 20 topo, backdrop blur 20.
- **Badge/Chip**: outline-first; preenchimento só para status crítico.
- **Toast**: ícone + título + descrição, accent lateral 2px na cor do status.
- **Skeleton**: shimmer sutil sobre bg-inset.
- **Empty state**: ícone outline grande + título + 1 ação.

## 4. Telas refinadas (sem mudar lógica)

1. **Dashboard (cockpit)** — hierarquia: KPI hero "Lucro líquido hoje" em display 32 mono, abaixo grid 2×2 (ganhos · despesas · km · tempo), depois OperationalStatusBadge, depois ações. Mais respiro, menos chips.
2. **ShiftMode** — hero do turno ativo com glow brand pulsante discreto, KPIs tabulares, botões de ação destacados.
3. **PermissionOnboarding** — vira "assistente de configuração": ilustração/ícone grande por etapa, copy em 2 níveis, progress dots, transição fade+slide 200ms.
4. **Bottom Nav** — ícones lucide outline 22px, label 11, item ativo: ícone preenchido + dot brand + glow-sm. Altura 64 + safe-area.
5. **SettingsView** — listas com section header uppercase, divisores hairline, sem cards aninhados.
6. **Auth** — fundo bg-base, logo centralizada com leve glow brand, card único bg-elevated.

## 5. Microinterações (CSS/Tailwind only, sem libs novas)

- KPI updates: `transition-[color,transform] duration-200`, flash brand 400ms ao recalcular
- Turno start/stop: pulse glow 1.6s ease-in-out infinite no badge
- Tap feedback: `active:scale-[0.98] transition-transform duration-100`
- Sheet/Modal: já usa Radix — só refinar tokens
- Tudo via `tailwindcss-animate` já instalado. Zero framer-motion novo.

## 6. Performance

- Sem novas dependências
- Fontes via `<link rel="preconnect">` Google Fonts, `display=swap`, subset latin
- Glow via `box-shadow` (compositor), sem filter blur em listas
- Animações ≤ 300ms, `prefers-reduced-motion` respeitado

## 7. Arquivos que serão tocados (apenas visual)

- `src/index.css` — tokens HSL, gradientes, glow, base typography
- `tailwind.config.ts` — cores semânticas, fontFamily, boxShadow, borderRadius
- `index.html` — preconnect + link Google Fonts (Space Grotesk + JetBrains Mono)
- `src/components/ui/button.tsx` `card.tsx` `badge.tsx` `input.tsx` `dialog.tsx` `sheet.tsx` `toast.tsx` — só variants/classes
- `src/components/Dashboard.tsx` `ShiftMode.tsx` `SettingsView.tsx` `PermissionOnboarding.tsx` `OperationalStatusBadge.tsx` — só JSX/classes
- Bottom nav (componente atual) — só classes

Nenhum hook, service, lib de GPS, storage, auth, supabase ou regra de negócio será alterado.

## 8. Critério de aceite

- App em dark mode com 4 níveis de superfície visíveis
- Verde da marca aparece **apenas** em sinais operacionais e CTA primário
- KPIs financeiros em fonte mono tabular, alinhados
- Bottom nav minimalista com estado ativo claro
- Onboarding sente "assistente", não "popup"
- Zero regressão funcional (tracking, turno, permissões, persistência)
- Bundle não cresce mais que ~15KB (apenas 2 famílias de fonte via CDN)

---

Posso seguir com a implementação nesta ordem: **(1) tokens + fontes → (2) componentes base → (3) bottom nav + dashboard → (4) shift + onboarding → (5) settings + auth**. Confirma?
