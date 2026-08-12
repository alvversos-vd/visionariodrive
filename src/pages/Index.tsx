import { useEffect, useState, lazy, Suspense } from 'react';
import { DailyEntry } from '@/lib/types';
import Dashboard from '@/components/Dashboard';
import DailyInputForm from '@/components/DailyInputForm';
import ProRequired from '@/components/ProRequired';
import PermissionOnboarding from '@/components/PermissionOnboarding';
import { isOnboardingCompleted } from '@/lib/permissionDiagnostic';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, BarChart3, Target, Navigation, Home, Settings as SettingsIcon, Lightbulb, User, Lock, Wallet, Sparkles, Loader2 } from 'lucide-react';
import RegisterRideFab from '@/components/RegisterRideFab';
import InstallAppButton from '@/components/InstallAppButton';
import NotificationActivationCard from '@/components/NotificationActivationCard';
import { achievementService } from '@/lib/services/achievementService';
import { BRAND_NAME, BRAND_TAGLINE } from '@/assets/branding/logo';
import BrandMark from '@/components/brand/BrandMark';
import { SessionModeProvider, useSessionMode } from '@/components/session/SessionModeContext';
import SessionOverlays from '@/components/session/SessionOverlays';


// Lazy-loaded heavy views — reduzem o bundle inicial (RC1 / Sprint 5.5).
// Cada view carrega apenas quando o usuário navegar até ela.
const ResultsView = lazy(() => import('@/components/ResultsView'));
const HistoryView = lazy(() => import('@/components/HistoryView'));
const RideAnalyzer = lazy(() => import('@/components/RideAnalyzer'));
const GoalsView = lazy(() => import('@/components/GoalsView'));
const SettingsView = lazy(() => import('@/components/SettingsView'));
const SimulatorView = lazy(() => import('@/components/SimulatorView'));
const ProfileView = lazy(() => import('@/components/ProfileView'));
const FinancialView = lazy(() => import('@/components/FinancialView'));
const UpgradeView = lazy(() => import('@/components/UpgradeView'));

function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="animate-spin" size={20} />
    </div>
  );
}

type Tab = 'home' | 'input' | 'ride' | 'goals' | 'financial' | 'history' | 'strategy' | 'settings' | 'profile' | 'upgrade';

// Sprint 10.6.x — Histórico liberado para START (somente exportação é PRO).
const PRO_TABS: Tab[] = ['strategy'];

export default function Index() {
  return (
    <SessionModeProvider>
      <IndexInner />
    </SessionModeProvider>
  );
}

function IndexInner() {
  const [tab, setTab] = useState<Tab>('home');
  const [result, setResult] = useState<DailyEntry | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { isPro, dataVersion } = useAuth();
  const { sessionMode } = useSessionMode();
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !isOnboardingCompleted());


  useEffect(() => {
    setRefresh(p => p + 1);
  }, [dataVersion]);

  useEffect(() => { achievementService.markTabVisited(tab); }, [tab]);

  useEffect(() => {
    const open = () => setShowOnboarding(true);
    window.addEventListener('vd-open-permission-onboarding', open);
    return () => window.removeEventListener('vd-open-permission-onboarding', open);
  }, []);

  const handleCalculate = (entry: DailyEntry) => {
    setResult(entry);
    setRefresh(p => p + 1);
  };

  const triggerRefresh = () => setRefresh(p => p + 1);

  const tabs: { key: Tab; label: string; icon: typeof Home; pro?: boolean }[] = [
    { key: 'home', label: 'Início', icon: Home },
    { key: 'input', label: 'Calcular', icon: Calculator },
    { key: 'ride', label: 'Corrida', icon: Navigation },
    { key: 'financial', label: 'Financeiro', icon: Wallet },
    { key: 'goals', label: 'Metas', icon: Target },
    { key: 'strategy', label: 'Estratégia', icon: Lightbulb, pro: true },
    { key: 'history', label: 'Histórico', icon: BarChart3, pro: true },
  ];

  // Sprint 7.5 Onda 2 — navegação "que respira": underline desliza, ícone sobe 2px,
  // label ganha peso, glow médio aparece. Sincronizado em 180ms.
  // Sprint 7.5 Onda 2 — navegação "que respira": underline desliza, ícone sobe 2px,
  // label ganha peso, glow médio aparece. Sincronizado em 180ms.
  // Sprint 10 — em Sessão Visionária, abas secundárias perdem destaque (só visual).
  const tabClass = (active: boolean, dimmed = false) =>
    `group relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-caption font-display tracking-wide rounded-md min-w-0 flex-1 press overflow-hidden transition-all duration-[180ms] ${
      active
        ? 'text-primary font-bold'
        : `text-muted-foreground font-semibold hover:text-foreground ${dimmed ? 'opacity-40' : ''}`
    } after:content-[""] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-[2px] after:rounded-full after:transition-all after:duration-[180ms] after:ease-out ${
      active
        ? `after:w-8 after:bg-primary ${dimmed ? '' : 'after:shadow-[0_0_10px_hsl(var(--primary)/0.65)]'}`
        : 'after:w-0 after:bg-transparent'
    }`;


  const iconClass = (active: boolean) =>
    `transition-transform duration-[180ms] ease-out ${active ? '-translate-y-0.5' : 'translate-y-0'}`;

  const isLocked = (key: Tab) => PRO_TABS.includes(key) && !isPro;

  const renderContent = () => {
    if (tab !== 'home' && tab !== 'input' && tab !== 'goals' && tab !== 'financial' && tab !== 'settings' && tab !== 'profile' && tab !== 'upgrade' && isLocked(tab)) {
      const labels: Partial<Record<Tab, string>> = {
        ride: 'a análise de corridas',
        strategy: 'as estratégias e simulador',
      };
      return <ProRequired feature={labels[tab]} onUpgrade={() => setTab('upgrade')} />;
    }

    switch (tab) {
      case 'home':
        return <div className="space-y-4"><NotificationActivationCard /><Dashboard refresh={refresh} onGoToGoals={() => setTab('goals')} onGoToUpgrade={() => setTab('upgrade')} /></div>;
      case 'upgrade':
        return <UpgradeView onDismiss={() => setTab('home')} />;
      case 'input':
        return result ? <ResultsView entry={result} onBack={() => setResult(null)} /> : <DailyInputForm onCalculate={handleCalculate} />;
      case 'ride':
        return <RideAnalyzer refresh={refresh} onGoToUpgrade={() => setTab('upgrade')} />;
      case 'goals':
        return <GoalsView refresh={refresh} onSaved={triggerRefresh} onEnterSession={() => setTab('home')} />;
      case 'financial':
        return <FinancialView refresh={refresh} onChanged={triggerRefresh} />;
      case 'strategy':
        return <SimulatorView refresh={refresh} />;
      case 'history':
        return <HistoryView refresh={refresh} onRefresh={triggerRefresh} />;
      case 'settings':
        return <SettingsView refresh={refresh} onChanged={triggerRefresh} />;
      case 'profile':
        return <ProfileView onReset={triggerRefresh} />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-hero border-b border-border/60 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-5">
        <div className="container max-w-lg mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <BrandMark size="sm" glow="soft" />
            <div className="min-w-0">
              <h1 className="font-display text-[17px] font-semibold text-foreground tracking-[-0.03em] leading-none truncate">{BRAND_NAME}</h1>
              <p className="text-micro text-muted-foreground uppercase tracking-[0.12em] mt-1.5 truncate">{BRAND_TAGLINE}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <InstallAppButton />
            <button
              onClick={() => setTab('profile')}
              className={`p-2 rounded-xl transition-colors press ${tab === 'profile' ? 'bg-gradient-brand text-primary-foreground shadow-glow-sm' : 'bg-secondary/70 text-foreground/80 hover:bg-secondary hover:text-foreground'}`}
              aria-label="Perfil"
            >
              <User size={18} />
            </button>
            <button
              onClick={() => setTab('settings')}
              className={`p-2 rounded-xl transition-colors press ${tab === 'settings' ? 'bg-gradient-brand text-primary-foreground shadow-glow-sm' : 'bg-secondary/70 text-foreground/80 hover:bg-secondary hover:text-foreground'}`}
              aria-label="Configurações"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 mt-4 space-y-4">
        <nav className="flex bg-card/60 border border-border/60 rounded-xl p-1 gap-0.5">
          {tabs.map(t => {
            const active = tab === t.key;
            const dimmed = sessionMode && t.key !== 'home';
            return (
              <button
                key={t.key}
                className={tabClass(active, dimmed)}

                onClick={() => {
                  setTab(t.key);
                  if (t.key !== 'input') setResult(null);
                }}
              >
                <t.icon size={16} className={iconClass(active)} />
                <span className="truncate">{t.label}</span>
                {t.pro && !isPro && (
                  <Lock size={8} className="absolute top-1 right-1 opacity-60" />
                )}
              </button>
            );
          })}
        </nav>

        <Suspense fallback={<ViewFallback />}>{renderContent()}</Suspense>
      </main>
      <RegisterRideFab onChange={triggerRefresh} />
      <SessionOverlays refresh={refresh} />
      {showOnboarding && <PermissionOnboarding onDone={() => setShowOnboarding(false)} />}

    </div>
  );
}
