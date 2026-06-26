import { useEffect, useState } from 'react';
import { DailyEntry } from '@/lib/types';
import Dashboard from '@/components/Dashboard';
import DailyInputForm from '@/components/DailyInputForm';
import ResultsView from '@/components/ResultsView';
import HistoryView from '@/components/HistoryView';
import RideAnalyzer from '@/components/RideAnalyzer';
import GoalsView from '@/components/GoalsView';
import SettingsView from '@/components/SettingsView';
import SimulatorView from '@/components/SimulatorView';
import ProfileView from '@/components/ProfileView';
import ExpensesView from '@/components/ExpensesView';
import ProRequired from '@/components/ProRequired';
import UpgradeView from '@/components/UpgradeView';
import PermissionOnboarding from '@/components/PermissionOnboarding';
import { isOnboardingCompleted } from '@/lib/permissionDiagnostic';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, BarChart3, Target, Navigation, Home, Settings as SettingsIcon, Lightbulb, User, Lock, Wallet, Sparkles } from 'lucide-react';
import RegisterRideFab from '@/components/RegisterRideFab';
import InstallAppButton from '@/components/InstallAppButton';

type Tab = 'home' | 'input' | 'ride' | 'goals' | 'expenses' | 'history' | 'strategy' | 'settings' | 'profile' | 'upgrade';

const PRO_TABS: Tab[] = ['history', 'strategy'];

export default function Index() {
  const [tab, setTab] = useState<Tab>('home');
  const [result, setResult] = useState<DailyEntry | null>(null);
  const [refresh, setRefresh] = useState(0);
  const { isPro, dataVersion } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !isOnboardingCompleted());

  useEffect(() => {
    setRefresh(p => p + 1);
  }, [dataVersion]);

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
    { key: 'expenses', label: 'Gastos', icon: Wallet },
    { key: 'goals', label: 'Metas', icon: Target },
    { key: 'strategy', label: 'Estratégia', icon: Lightbulb, pro: true },
    { key: 'history', label: 'Histórico', icon: BarChart3, pro: true },
  ];

  const tabClass = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 text-[10px] font-display font-semibold tracking-wide transition-all duration-150 rounded-md min-w-0 flex-1 press ${
      active
        ? 'bg-gradient-brand text-primary-foreground shadow-glow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
    }`;

  const isLocked = (key: Tab) => PRO_TABS.includes(key) && !isPro;

  const renderContent = () => {
    if (tab !== 'home' && tab !== 'input' && tab !== 'goals' && tab !== 'expenses' && tab !== 'settings' && tab !== 'profile' && tab !== 'upgrade' && isLocked(tab)) {
      const labels: Partial<Record<Tab, string>> = {
        ride: 'a análise de corridas',
        history: 'o histórico completo',
        strategy: 'as estratégias e simulador',
      };
      return <ProRequired feature={labels[tab]} onUpgrade={() => setTab('upgrade')} />;
    }

    switch (tab) {
      case 'home':
        return <Dashboard refresh={refresh} onGoToInput={() => setTab('input')} onGoToGoals={() => setTab('goals')} onGoToUpgrade={() => setTab('upgrade')} />;
      case 'upgrade':
        return <UpgradeView onDismiss={() => setTab('home')} />;
      case 'input':
        return result ? <ResultsView entry={result} onBack={() => setResult(null)} /> : <DailyInputForm onCalculate={handleCalculate} />;
      case 'ride':
        return <RideAnalyzer refresh={refresh} onGoToUpgrade={() => setTab('upgrade')} />;
      case 'goals':
        return <GoalsView refresh={refresh} onSaved={triggerRefresh} />;
      case 'expenses':
        return <ExpensesView refresh={refresh} onChanged={triggerRefresh} />;
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
      <header className="bg-hero border-b border-border/60 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <div className="container max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-brand shadow-glow-sm flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground text-lg leading-none">V</span>
            </div>
            <div>
              <h1 className="font-display text-[17px] font-bold text-foreground tracking-tight leading-none">Visionario Drive</h1>
              <p className="text-[10px] text-muted-foreground tracking-wide mt-1">Lucro real · Decisão rápida · Controle</p>
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
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
          {tabs.map(t => (
            <button
              key={t.key}
              className={tabClass(tab === t.key)}
              onClick={() => {
                setTab(t.key);
                if (t.key !== 'input') setResult(null);
              }}
            >
              <t.icon size={16} />
              <span className="truncate">{t.label}</span>
              {t.pro && !isPro && (
                <Lock size={8} className="absolute top-1 right-1 opacity-60" />
              )}
            </button>
          ))}
        </nav>

        {renderContent()}
      </main>
      <RegisterRideFab onChange={triggerRefresh} />
      {showOnboarding && <PermissionOnboarding onDone={() => setShowOnboarding(false)} />}
    </div>
  );
}
