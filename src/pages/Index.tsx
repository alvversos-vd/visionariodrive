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
    `relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-[10px] font-display font-semibold transition-colors rounded-md min-w-0 flex-1 ${
      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
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
      <header className="bg-hero border-b border-border/60 px-4 pt-6 pb-4 shadow-premium">
        <div className="container max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground tracking-tight">Visionario Drive</h1>
            <p className="text-[11px] text-muted-foreground">Lucro real • Decisão rápida • Controle</p>
          </div>
          <div className="flex gap-2 items-center">
            <InstallAppButton />
            <button
              onClick={() => setTab('profile')}
              className={`p-2 rounded-xl transition-colors ${tab === 'profile' ? 'bg-primary text-primary-foreground' : 'bg-secondary/70 text-foreground hover:bg-secondary'}`}
              aria-label="Perfil"
            >
              <User size={20} />
            </button>
            <button
              onClick={() => setTab('settings')}
              className={`p-2 rounded-xl transition-colors ${tab === 'settings' ? 'bg-primary text-primary-foreground' : 'bg-secondary/70 text-foreground hover:bg-secondary'}`}
              aria-label="Configurações"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 mt-4 space-y-4">
        <nav className="flex bg-secondary rounded-lg p-1 gap-1">
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
