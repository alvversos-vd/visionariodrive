# Reestruturação Mobile do Visionario Drive

Objetivo: transformar o app num rastreador operacional confiável em celular real (Android/iOS, navegador e PWA), com GPS pedindo permissão corretamente, km contabilizado de verdade, turno sobrevivendo a minimizar/bloquear tela, e auto-save em tempo real.

Vou entregar em **4 fases**, da mais crítica pra mais visual. Você pode aprovar tudo de uma vez ou pedir pra eu parar entre fases.

---

## Fase 1 — GPS confiável + permissão profissional (CRÍTICO)

Resolve "GPS não pede permissão" e "km não conta".

- **Modal de explicação humanizada antes do prompt nativo**
  - Componente `GpsConsentDialog` com o texto pedido (km, rota, lucro, custo/km, "nunca compartilhada")
  - Só dispara `navigator.geolocation` depois do "Aceitar"
  - Persiste em localStorage se o usuário já consentiu (não repete toda vez)
- **Refatorar `useShiftTracker`** pra usar `watchPosition` com `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 15000`
- **Detecção de permissão via `navigator.permissions.query({name:'geolocation'})`** quando disponível, fallback pro fluxo clássico no iOS Safari (que não suporta)
- **Mensagens de ajuda específicas iOS vs Android** quando permissão for negada
- **Filtros anti-jitter já existem** (`accuracy > 50`, `< 10m`, `> 200km/h`) — vou ajustar limiar mínimo pra 8m e adicionar filtro de `speed < 0.5 m/s` (parado)
- **Captura completa**: salvar `speed` e `heading` no buffer pra usar no mapa

## Fase 2 — Persistência real + recuperação de turno + background

Resolve "estado do turno se perde" e "background instável".

- **Migrar storage de turnos pra IndexedDB** via `idb-keyval` (mais robusto que localStorage, sobrevive a limpezas leves do iOS)
  - Mantém fallback localStorage pra compat
- **Timer baseado em timestamp** (já está assim em `tempoOnlineMs`, mas vou auditar pra garantir que nenhum lugar usa contador incremental)
- **Auto-restore ao abrir o app**: na montagem do `ShiftMode`, se `getActiveShift()` retorna algo, restaura sem pedir ação do usuário (já existe parcialmente — vou validar e cobrir edge cases)
- **`visibilitychange` + `pagehide`/`pageshow`**: ao voltar do background, recalcula km/timer usando timestamps reais; força flush do buffer GPS
- **Wake Lock API** (`navigator.wakeLock.request('screen')`) opcional durante turno ativo pra reduzir kill em background no Android
- **Service worker periodic sync** NÃO vou implementar (requer permissão especial e não funciona em iOS). Em vez disso, na volta de foreground reconciliamos tudo via timestamps.
- ⚠️ **Limitação honesta**: navegadores web (especialmente iOS Safari) **suspendem JS em background**. Não existe geolocation contínua real em background num PWA puro de iOS. O GPS volta ao foreground. Pra background contínuo de verdade precisaria Capacitor + plugin nativo (Background Geolocation). Posso adicionar isso na Fase 4 se você quiser app nativo — me confirma.

## Fase 3 — PWA instalável + offline

- `vite-plugin-pwa` com `registerType: autoUpdate`, `devOptions.enabled: false`, guard de iframe (preview Lovable)
- `manifest.json`: nome, ícones (192/512/maskable), `display: standalone`, theme/background color do brand, `start_url: /`
- Splash screen via meta tags iOS
- Service worker com `NetworkFirst` pra HTML, cache de assets estáticos
- Denylist `/~oauth` no navigateFallback
- Banner discreto "Instalar app" no Android (beforeinstallprompt) e instrução "Compartilhar → Tela de Início" no iOS

## Fase 4 — Mapa ao vivo + otimização de bateria

- **Leaflet** (open-source, sem API key) com tile OSM
  - Polyline desenhando rota em tempo real conforme `watchPosition` dispara
  - Marker com rotação baseada em `heading`
  - Auto-pan suave (`map.panTo` com animação)
- **Otimização adaptativa**:
  - Se `speed < 1 m/s` por 60s → aumenta `maximumAge` pra reduzir custo
  - Se movimento detectado → volta a 0
- Toggle "Mostrar mapa" no `ShiftMode` (pode ser pesado pra alguns devices)

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/components/GpsConsentDialog.tsx`
- `src/lib/shiftStorage.ts` (camada IndexedDB + fallback)
- `src/components/ShiftLiveMap.tsx` (Fase 4)
- `public/manifest.json` + ícones
- `vite.config.ts` com VitePWA

**Arquivos a editar:**
- `src/hooks/useShiftTracker.ts` — fluxo de consentimento, filtros, speed/heading, visibility handler
- `src/lib/shifts.ts` — async storage, route polyline persistida
- `src/components/ShiftMode.tsx` — integrar dialog, banners GPS, mapa
- `index.html` — meta tags PWA iOS

**Dependências novas:**
- `idb-keyval` (~600B, IndexedDB simples)
- `leaflet` + `react-leaflet` (Fase 4)
- `vite-plugin-pwa` (Fase 3)

**Anti-bugs reforçados:**
- `safeNum` já existe em `computeTotals`
- Adicionar guards em km acumulado (max 1000 km/turno como sanity check)
- Throttle de saves no IndexedDB (já existe debounce de 1.5s no buffer GPS)

---

## O que NÃO vou fazer sem confirmação

- **Capacitor / app nativo real**: se você quer background GPS real em iOS, precisa ser app nativo. Posso configurar Capacitor numa fase 5, mas exige você exportar pro GitHub e rodar Xcode/Android Studio localmente. Me avisa se quer.
- **Reescrever UI do `ShiftMode`**: mantenho a UI atual, só adiciono os elementos novos (dialog, banner, mapa opcional).
- **Mexer em features não-relacionadas** (histórico, settings, legal, etc.) — ficam intactas.

---

## Pergunta antes de começar

Quer que eu execute **as 4 fases em sequência num único passo**, ou prefere que eu pare depois da Fase 1+2 (estabilidade GPS e persistência) pra você testar antes de eu seguir pra PWA e mapa?