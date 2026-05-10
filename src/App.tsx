import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";
import Onboarding from "./components/Onboarding.tsx";

const queryClient = new QueryClient();

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-2xl shadow-lg animate-pulse">
        VD
      </div>
      <p className="font-display text-lg font-bold text-foreground">Visionario Delivery Pro</p>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="animate-spin" size={16} />
        <span>{label}</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, dataReady, profile } = useAuth();
  if (loading) return <FullScreenLoader label="Iniciando..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!dataReady) return <FullScreenLoader label="Carregando seus dados..." />;
  if (profile && !profile.onboarding_completo) return <Onboarding onFinish={() => { /* re-render via refreshProfile */ }} />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
