
# Arquitetura definitiva: Permissões GPS resilientes a fabricantes Android

## Diagnóstico da causa raiz

Hoje o app depende de:
1. Intents específicas do Android (`ACTION_APPLICATION_DETAILS_SETTINGS`, `ACTION_LOCATION_SOURCE_SETTINGS`) que Samsung/Xiaomi/Realme/Motorola implementam de forma inconsistente.
2. Consentimento UI (clique em "Aceitar") como proxy de permissão real — não reflete o estado nativo.
3. Banner reativo após o turno iniciar — usuário descobre o problema tarde demais.

**Causa raiz:** o app trata permissão como evento UI, não como **estado do dispositivo lido em tempo real**. A correção definitiva é inverter: a fonte da verdade é sempre `VisionarioPermissionsPlugin.getStatus()`, e o produto opera em dois modos baseados nesse status — nunca bloqueia o usuário.

---

## O que será construído

### 1. `PermissionDiagnosticService` (src/lib/permissionDiagnostic.ts)

Serviço único, desacoplado, fonte da verdade para permissões:

```ts
type PermissionDiagnostic = {
  locationGranted: boolean;
  backgroundLocationGranted: boolean;
  notificationsGranted: boolean;
  batteryOptimizationDisabled: boolean;
  gpsReady: boolean;
  trackingMode: "automatic" | "manual";
  platform: "android" | "ios" | "web";
  androidVersion: number | null;
  reasons: string[]; // por que está em manual
};
```

- Lê via `VisionarioPermissionsPlugin` no Android nativo.
- Fallback via `navigator.permissions` + `Notification.permission` em PWA/web.
- `trackingMode = "automatic"` apenas quando `locationGranted && backgroundLocationGranted && notificationsGranted && gpsReady`.
- Cacheia última leitura + emite eventos (`onChange`) quando muda — consumido por dashboard, ShiftMode e onboarding.
- Re-valida em: app resume, foco da janela, retorno de Settings, início de turno.

### 2. Plugin nativo — extensões

Adicionar em `VisionarioPermissionsPlugin.java`:
- `isBatteryOptimizationDisabled()` via `PowerManager.isIgnoringBatteryOptimizations`.
- `requestIgnoreBatteryOptimization()` via `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
- `isLocationProviderEnabled()` via `LocationManager.isProviderEnabled(GPS_PROVIDER)`.
- Manter o `requestBackgroundLocationPermission` atual; **não depender de intent específica de fabricante**.

### 3. Onboarding guiado obrigatório (src/components/PermissionOnboarding.tsx)

Fluxo bloqueante após cadastro / antes do primeiro turno, com 5 passos sequenciais. Cada passo:
- Texto curto explicando o porquê.
- Botão "Permitir" → dispara request nativo.
- Após cada request: `PermissionDiagnosticService.refresh()` valida o estado **real**.
- Só avança quando o status nativo confirma — não pelo clique.
- Botão secundário "Pular e usar Modo Manual" em qualquer passo (não bloqueia o produto).

Passos:
1. Intro: "Visionário usa GPS para registrar km, tempo e ganhos automaticamente."
2. Localização (fine).
3. Localização em segundo plano ("Permitir o tempo todo").
4. Notificações (Android 13+).
5. Resumo: mostra diagnóstico final + escolhe modo.

Flag persistida: `vd-permission-onboarding-completed-v1`.

### 4. Dois modos operacionais

**Modo Automático** (padrão quando elegível):
- `useShiftTracker` ativo, GPS contínuo, polyline, km calculados.
- Comportamento atual preservado.

**Modo Manual** (quando faltar qualquer requisito crítico):
- `useShiftTracker` não inicia GPS.
- ShiftMode mostra formulário para inserção manual de km inicial/final, tempo e ganhos por corrida.
- Reaproveita `RegisterRideFab` + `DailyInputForm`.
- Persistência idêntica (mesmo schema de shifts/rides) — telemetria marca `source: "manual"`.

Modo é decidido por `PermissionDiagnosticService.trackingMode`, com override manual do usuário (Configurações → "Forçar modo manual").

### 5. Dashboard com status operacional permanente

Componente novo `OperationalStatusBadge.tsx`, sempre visível no Dashboard e ShiftMode:
- 🟢 "Rastreamento automático ativo"
- 🟡 "Modo manual ativo" + razão curta (ex: "Localização em segundo plano não autorizada")
- Botão "Corrigir configuração" → reabre `PermissionOnboarding` no passo pendente.

### 6. Refator dos pontos atuais

- `ShiftMode.tsx`: remover lógica ad-hoc de banner/permissão; consumir `PermissionDiagnosticService` + `OperationalStatusBadge`. Decide entre tracker automático e UI manual.
- `useShiftTracker.ts`: aceita `mode: "automatic" | "manual"`; em manual, é no-op de GPS mas mantém estado do turno.
- `bgPermission.ts`: torna-se wrapper fino sobre `PermissionDiagnosticService` (mantém compat) e depois é removido.
- `GpsConsentDialog` / `BackgroundLocationConsentDialog`: descontinuados — substituídos pelos passos do `PermissionOnboarding`. Removidos da árvore.
- `Index.tsx` / rota raiz: se autenticado e `!onboarding-completed`, renderiza `PermissionOnboarding` antes de qualquer outra tela.

### 7. Resiliência a fabricantes

- Zero dependência em intents específicas. O "Abrir configurações" abre o que conseguir (details → fallback location settings → fallback toast com instrução textual).
- Se após N tentativas a permissão real continuar negada, o app **simplesmente opera em manual** — sem loop de erro, sem bloqueio.
- Telemetria registra `manufacturer`, `androidVersion`, `permissionPath` para análise futura.

---

## Arquivos

**Novos**
- `src/lib/permissionDiagnostic.ts`
- `src/components/PermissionOnboarding.tsx`
- `src/components/OperationalStatusBadge.tsx`

**Editados**
- `android/.../VisionarioPermissionsPlugin.java` (battery + provider checks)
- `src/components/ShiftMode.tsx` (consome diagnostic + badge + modo manual)
- `src/hooks/useShiftTracker.ts` (suporta modo manual)
- `src/components/Dashboard.tsx` (badge no topo)
- `src/pages/Index.tsx` (gate de onboarding)
- `src/components/SettingsView.tsx` (toggle "forçar manual" + reabrir onboarding)
- `src/lib/bgPermission.ts` (wrapper sobre diagnostic)

**Removidos da árvore (mantidos como deprecated 1 versão)**
- `GpsConsentDialog.tsx`, `BackgroundLocationConsentDialog.tsx`

---

## Critérios de aceite

1. Usuário novo passa por onboarding antes do 1º turno.
2. Cada passo só avança quando o status nativo confirma — não pelo clique.
3. Negar background não bloqueia uso: cai em manual com badge 🟡.
4. Voltar de Settings com permissão concedida → badge muda para 🟢 sem refresh.
5. Nenhum fluxo crítico depende de intent específica de fabricante.
6. `useShiftTracker` não inicia GPS em modo manual (zero drenagem de bateria).
7. Persistência de turnos/corridas/km idêntica nos dois modos.

---

## Fora de escopo

- Capacitor background-geolocation plugin (foreground service real). Fica anotado para fase 2 — a arquitetura proposta já está pronta para receber.
- iOS native: o serviço já suporta, mas validação visual é só Android nesta entrega.
