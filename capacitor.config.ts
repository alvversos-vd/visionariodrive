import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Phase 1 — preparação arquitetural.
 *
 * Esta config é o ponto de partida para empacotar o PWA atual como app
 * nativo (Android/iOS) SEM quebrar o MVP web. O dev usa o build web
 * normalmente; só quem rodar `npx cap add ios|android` + `npx cap sync`
 * em uma máquina local (Xcode/Android Studio) materializa o app nativo.
 *
 * Hot-reload do sandbox: o `server.url` aponta para o preview do Lovable
 * para que, em desenvolvimento nativo, o app carregue a UI live.
 * REMOVER `server.url` antes do build de produção pra lojas.
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.fa6584b5282341a1b19d2e91ce68bac4',
  appName: 'visionariodrive',
  webDir: 'dist',
  server: {
    url: 'https://fa6584b5-2823-41a1-b19d-2e91ce68bac4.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      // Permissões reais do sistema serão pedidas pelo plugin nativo.
      // Texto de uso (iOS) precisa ser configurado no Info.plist:
      //   NSLocationWhenInUseUsageDescription
      //   NSLocationAlwaysAndWhenInUseUsageDescription
    },
  },
};

export default config;
