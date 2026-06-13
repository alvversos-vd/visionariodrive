import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Phase 1 — preparação arquitetural.
 *
 * Esta config é o ponto de partida para empacotar o PWA atual como app
 * nativo (Android/iOS) SEM quebrar o MVP web. O dev usa o build web
 * normalmente; só quem rodar `npx cap add ios|android` + `npx cap sync`
 * em uma máquina local (Xcode/Android Studio) materializa o app nativo.
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.fa6584b5282341a1b19d2e91ce68bac4',
  appName: 'visionariodrive',
  webDir: 'dist',

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUÇÃO / APK DE VALIDAÇÃO: `server.url` REMOVIDO de propósito.
  //
  // Sem `server.url`, o Capacitor serve o bundle de `dist/` empacotado no APK.
  // Isso é OBRIGATÓRIO para:
  //   - permissões nativas reais (ACCESS_FINE_LOCATION / WhenInUse)
  //   - @capacitor/geolocation funcionar como plugin nativo (não WebView remota)
  //   - funcionamento offline
  //
  // Fluxo de build após qualquer mudança:
  //   npm run build && npx cap sync android
  //
  // ─── HOT-RELOAD EM DEV (opcional) ────────────────────────────────────────
  // Para desenvolvimento local com hot-reload apontando para o preview do
  // Lovable, descomente o bloco `server` abaixo TEMPORARIAMENTE. NUNCA
  // commitar com `server.url` ativo — quebra permissões nativas e gera APK
  // dependente do preview/internet.
  //
  // server: {
  //   url: 'https://fa6584b5-2823-41a1-b19d-2e91ce68bac4.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
  // ─────────────────────────────────────────────────────────────────────────

  plugins: {
    Geolocation: {
      // Permissões reais do sistema serão pedidas pelo plugin nativo.
    },
    BackgroundGeolocation: {
      // Configurado em runtime via addWatcher (backgroundTitle/backgroundMessage).
      // Estes textos definem o conteúdo da notificação persistente Android
      // exibida durante turno ativo. Plugin requer foreground service.
    },
  },
};

export default config;