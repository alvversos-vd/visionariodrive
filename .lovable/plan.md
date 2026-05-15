# Modo Turno em Tempo Real (estilo Strava)

Transformar o turno do Visionario Drive em uma experiência viva: GPS rastreando km automaticamente, timer ao vivo, pausa/retomada, modo foco e feedback motivador. Funciona em PWA/navegador moderno usando Geolocation API nativa.

## 1. Camada de dados — `src/lib/shifts.ts`

Estender o tipo `Shift`:
- `status: 'ativo' | 'pausado' | 'finalizado'`
- `km_gps: number` (km acumulados via GPS, separado dos km manuais das corridas)
- `pausas: { inicio: string; fim?: string }[]` (para descontar tempo pausado)
- `ultima_corrida_iso?: string` (timestamp da última corrida, para auto-preencher km da próxima)
- `km_acumulado_desde_ultima_corrida: number` (zerado a cada corrida registrada)

Novas funções:
- `pauseShift(id)` / `resumeShift(id)`
- `addGpsDistance(id, meters)` — soma km_gps e km_acumulado_desde_ultima_corrida
- `addRideAuto(id, valor, km?)` — usa `km_acumulado_desde_ultima_corrida` se km não informado, e zera o contador
- `tempoOnlineMinutos(shift)` — calcula tempo descontando pausas
- `metaProgresso(shift)` — % e valor faltante baseados em `goals.daily`

`computeTotals` usa `Math.max(km_total_corridas, km_gps)` para custos (evita km duplicado/falso).

## 2. Hook GPS — `src/hooks/useShiftTracker.ts` (novo)

- `navigator.geolocation.watchPosition` com `enableHighAccuracy: true`
- Timer de re-render a cada 1s (para timer/km ao vivo)
- Filtros anti-bug:
  - ignorar pontos com `accuracy > 50m`
  - ignorar deslocamentos < 10m (ruído GPS parado)
  - ignorar velocidades > 200 km/h (jumps falsos)
  - throttle: máx 1 ponto a cada 3s
- Distância via fórmula de Haversine entre pontos consecutivos
- Pausa o tracking quando shift estiver `pausado`
- Trata permissão negada/GPS off → toast informativo, app continua funcionando manualmente
- Limpa `watchId` ao finalizar/desmontar

## 3. ShiftMode redesenhado — `src/components/ShiftMode.tsx`

### Hero ativo (turno rodando)
Card grande estilo Strava:
- Status pill: 🟢 Turno ativo / 🟡 Pausado
- **Lucro gigante** (text-5xl) — atualiza ao vivo
- 4 stats em grid: ⏱ Tempo · 📍 Km GPS · 📦 Corridas · ⚡ R$/km
- Barra de progresso da meta diária com %, "Faltam R$ X"
- Botões: ⏸ Pausar · 🎯 Foco · ⏹ Finalizar

### Modo Foco
Toggle que esconde o resto do app (overlay fullscreen `fixed inset-0`) mostrando só:
lucro · km · tempo · botão "Registrar corrida" · botão sair do foco

### Modal de registro rápido
- **Apenas campo valor** (km opcional, pré-preenchido com `km_acumulado_desde_ultima_corrida` mostrando "📍 5.2 km desde última")
- Preview ao vivo de R$/km e classificação (boa/aceitável/ruim)
- Toast de feedback colorido após salvar

### Resumo final (já existe, polir)
- Card grande com 💰 Lucro · 📍 Km · 📦 Corridas · ⏱ Tempo · ⚡ R$/km · 🎯 % meta
- Animação `animate-slide-up` + emoji motivador

## 4. Histórico estilo feed — `src/components/ShiftHistoryView.tsx`
Cada turno vira um card visual com ícone do veículo, app, lucro destacado, km, horas, badge de meta atingida.

## 5. Integração

- `RegisterRideFab` passa a usar `addRideAuto` e exibe km auto-preenchido
- `Dashboard` continua mostrando dados do turno ativo (já feito)
- Modo foco é um overlay próprio dentro de `ShiftMode`, então não exige mudança no `Index`

## Notas técnicas

- GPS funciona em PWA HTTPS — fallback gracioso quando indisponível
- Estado do shift é persistido em `localStorage` (já é), então sobrevive a refresh/minimizar
- Timer usa `setInterval(1s)` apenas quando shift ativo+não pausado
- `computeTotals` recalculado a cada tick via `useMemo` dependente de `force`

## Arquivos

- editar: `src/lib/shifts.ts`
- novo: `src/hooks/useShiftTracker.ts`
- editar: `src/components/ShiftMode.tsx` (refatoração grande)
- editar: `src/components/RegisterRideFab.tsx`
- editar: `src/components/ShiftHistoryView.tsx`
