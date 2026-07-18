# Sprint 6.3 — Plano de Execução

Sprint grande e com duas fases obrigatoriamente sequenciais. Antes de tocar em código, quero alinhar escopo, ordem e um ponto crítico de arquitetura mobile que precisa da sua decisão.

---

## Fase 1 — Finalização da Gamificação (SEM riscos arquiteturais)

Toda a Fase 1 é frontend + catálogo + telemetria, encaixando no que já existe (`xpService`, `achievementService`, `xpEngine`, `catalog.ts`, hooks reativos via bus). Zero mudança de camada.

### 1.1 Perfil Inteligente expandido
Expandir `ProfileGamificationCard.tsx` (nada novo, só stats novos vindos de `achievementService.snapshotContext` + `xpService`):
- Data de cadastro, dias usando o app, XP total, XP hoje, maior sequência, melhor faturamento diário, maior turno, km totais, corridas totais, turnos totais.
- Novos getters em `xpService` (`xpEarnedToday()`) e em `achievementService.snapshotContext` (`bestDailyEarned`, `longestShiftMs`) — derivados do que já existe, sem novo storage.

### 1.2 Histórico de Conquistas
Modal "Todas as Conquistas" acionado por botão no card. Já temos `useAchievements` retornando `unlocked` + `locked` com `progress`. Só nova UI (`AchievementsModal.tsx`) — ícone, nome, descrição, raridade, XP, barra de progresso "8/10".

### 1.3 Level Up Modal
Componente `LevelUpModal.tsx` que escuta `level-up` via `useBusVersion`. Já emitido pelo `xpEngine`. Mostra "Nível X alcançado / +XP / conquistas desbloqueadas na sessão". Animação com Tailwind (`animate-in`).

### 1.4 Barra Global
Já existe `XpProgressBar`. Adicionar linha "XP restante para o próximo nível" (dado já calculado em `xpService.progress()`).

### 1.5 Conquistas especiais
Adicionar em `src/lib/gamification/catalog.ts`:
- ⭐ **Fundador** — cadastro antes de uma data-limite fixa.
- ⭐ **Beta Tester** — flag em `profiles` (nova coluna `beta_tester boolean default false`). **Precisa de migração** — confirme se ok.
- ⭐ **Explorador** — visitou todas as abas (novo `visitedTabs: Set<string>` em `xpRepository` snapshot local, atualizado por um novo evento leve `tab:visited` no bus).
- ⭐ **Persistente 30 dias**, ⭐ **Visionário 100 turnos**, ⭐ **Elite 500 corridas** — puro catálogo + `snapshotContext` (já temos `consecutiveDays`, `shiftsTotal`, `ridesTotal`).

### 1.6 Estatísticas — Minha Evolução
Gráfico simples com **Recharts** (já instalado, usado em `HistoryCharts`). Fonte: novo bucket `xpHistory: [{weekIso, xp, level}]` derivado on-the-fly em `xpService.weeklySeries()` a partir do log já persistido (ou reconstruído a partir dos eventos `xp:earned` acumulados em memória + snapshot semanal salvo por semana no `gamificationRepository`).

### 1.7 Telemetria
`achievement_view`, `achievement_details`, `levelup_modal` via `telemetry.ts`. Sem PII.

### 1.8 Docs
Atualiza ADR-009, ADR-010; cria ADR-011 "Gamification Module Completed".

---

## Fase 2 — Driver Quick Actions

### ⚠️ Decisão arquitetural crítica (preciso da sua confirmação)

O escopo pede **notificação persistente do Android como painel operacional**, com **Foreground Service** e **botões que executam ações sem abrir o app**. Hoje o projeto **não tem isto**:

- Não temos um Foreground Service com actions.
- `@capacitor/local-notifications` (o que existe hoje via `gpsBackgroundProvider`) **não suporta ações que retornam à JS layer quando o app está morto** de forma confiável — actions só disparam se o app está em background/foreground vivo.
- Um "painel operacional" real com botões que funcionam com o app matado exige **código Java nativo novo** (`ForegroundService` custom + `NotificationCompat.Action` + `BroadcastReceiver` que enfileira a ação e acorda a WebView, ou um `capacitor-plugin` custom).

Isto é **fora do padrão arquitetural congelado** — é infra nova, não Service/Repository/EventBus. Não dá pra "reutilizar exclusivamente a infraestrutura oficial" para isso porque a infra nativa não existe.

**Preciso que você escolha uma das opções antes de eu começar a Fase 2:**

**Opção A — Full nativo (fiel ao escopo, ~2-3 sprints só disto)**
Criar plugin Capacitor Java novo: Foreground Service com `NotificationCompat` de 3 actions (Registrar / Finalizar / Confirmar Auto), `BroadcastReceiver` que faz bridge com JS via `Plugin.notifyListeners`, `notificationActionService` (TS) que recebe o evento e chama `RideService`/`ShiftService`. UI de registro rápido = mini-activity nativa OU deep-link para tela dedicada `/quick/register` que abre o app. PWA fica com fallback (comportamento atual). Requer builds Android e testes em device real.

**Opção B — Escopo reduzido (o que dá pra fazer sem quebrar Release Freeze)**
Manter a notificação de tracking atual, **enriquecer o texto** com corridas/km/lucro em tempo real (reagindo ao bus, sem polling), e **adicionar 2 actions "deep-link"**: tocar em "Registrar" abre o app já com o modal `RegisterRideFab` aberto; tocar em "Finalizar" abre com o dialog de fim de turno. Notificação de "corrida detectada" idem, abre no toast existente `AutoRideToast`. **Sem código Java novo, sem plugin custom, 100% dentro da arquitetura.** Cobre 80% da UX prometida, é a que respeita "arquitetura congelada".

**Opção C — Adiar Fase 2 inteira para Sprint 7**
Fecho a Fase 1 nesta Sprint (é substancial sozinha), documento a Fase 2 no roadmap com o plano da Opção A completo, e Sprint 7 vira "Driver Quick Actions Nativas" com escopo próprio pra fazer certo. Alinhado com Release Freeze — não introduz risco no RC1.

### Minha recomendação: **Opção C**

Motivos:
1. Fase 1 sozinha é uma sprint cheia (perfil expandido, modal de conquistas, level-up, gráfico, 6 conquistas novas, telemetria, 3 docs).
2. Opção A quebra Release Freeze (código nativo novo, permissões novas potenciais, precisa reabrir security-audit, play-store-checklist, LGPD e testar em device físico antes de publicar).
3. Opção B entrega valor mas o próprio texto da Sprint deixa claro que quer o painel real ("operar sem abrir o Dashboard") — meio-caminho vai frustrar.
4. RC1 já está aprovado GO. Meter plugin nativo agora reabre riscos de crash/permissão que a Sprint 5 fechou.

---

## O que eu preciso de você

**Confirme:**
1. **Fase 2 → Opção A, B ou C?** (recomendo C)
2. **Coluna `beta_tester` em `profiles`** — ok criar migração? (necessário pra conquista Beta Tester)
3. **Data de corte da conquista Fundador** — que data usar? (sugiro `2026-12-31` — todos os cadastros de 2026 são fundadores)

Assim que responder, sigo. Se for C, fecho Fase 1 nesta rodada e entrego docs + roadmap atualizado.
