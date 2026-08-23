import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Legal from "./pages/Legal.tsx";
import NotFound from "./pages/NotFound.tsx";
import Onboarding from "./components/Onboarding.tsx";
import AdminCRM from "./pages/AdminCRM.tsx";
import GpsDebugButton from "./components/GpsDebugButton.tsx";
import ExportDebugButton from "./components/ExportDebugButton.tsx";
import AutoRideToast from "./components/AutoRideToast.tsx";
import AchievementToast from "./components/gamification/AchievementToast.tsx";
import LevelUpModal from "./components/gamification/LevelUpModal.tsx";
import GamificationBoot from "./components/gamification/GamificationBoot.tsx";
import NotificationActionsBoot from "./components/native/NotificationActionsBoot.tsx";
import { BRAND_NAME } from "@/assets/branding/logo";
import BrandMark from "@/components/brand/BrandMark";
import { useEffect } from "react";


const queryClient = new QueryClient();

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
      <BrandMark size="lg" glow="soft" className="animate-splash-in" />
      <p className="font-display text-lg font-semibold text-foreground tracking-[-0.03em]">{BRAND_NAME}</p>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="animate-spin" size={16} />
        <span>{label}</span>
      </div>
    </div>
  );
}

/** Sinaliza para o splash HTML que a app está pronta (uma vez por sessão). */
function AppReadySignal() {
  useEffect(() => {
    window.dispatchEvent(new Event('vd-app-ready'));
  }, []);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, dataReady, profile } = useAuth();
  console.info('[NOTIF-LIFECYCLE] ProtectedRoute', {
    userId: user?.id ?? null,
    loading,
    dataReady,
    profileLoaded: profile !== null,
    onboardingComplete: profile?.onboarding_completo ?? null,
  });
  if (loading) {
    console.info('[NOTIF-LIFECYCLE] ProtectedRoute -> loader:initializing');
    return <FullScreenLoader label="Iniciando..." />;
  }
  if (!user) {
    console.info('[NOTIF-LIFECYCLE] ProtectedRoute -> auth');
    return <Navigate to="/auth" replace />;
  }
  if (!dataReady) {
    console.info('[NOTIF-LIFECYCLE] ProtectedRoute -> loader:data');
    return <FullScreenLoader label="Carregando seus dados..." />;
  }
  if (profile && !profile.onboarding_completo) {
    console.info('[NOTIF-LIFECYCLE] ProtectedRoute -> onboarding');
    return <Onboarding onFinish={() => { console.info('[NOTIF-LIFECYCLE] Onboarding onFinish reached ProtectedRoute'); }} />;
  }
  console.info('[NOTIF-LIFECYCLE] ProtectedRoute -> protected content');
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GpsDebugButton />
      <ExportDebugButton />
      <AutoRideToast />
      <AchievementToast />
      <LevelUpModal />
      <BrowserRouter>

        <AuthProvider>
          <AppReadySignal />
          <GamificationBoot />
          <NotificationActionsBoot />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/admin" element={<ProtectedRoute><AdminCRM /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
