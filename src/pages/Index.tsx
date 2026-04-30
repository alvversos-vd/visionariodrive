import { useState } from 'react';
import { DailyEntry } from '@/lib/types';
import Dashboard from '@/components/Dashboard';
import DailyInputForm from '@/components/DailyInputForm';
import ResultsView from '@/components/ResultsView';
import HistoryView from '@/components/HistoryView';
import RideAnalyzer from '@/components/RideAnalyzer';
import GoalsView from '@/components/GoalsView';
import SettingsView from '@/components/SettingsView';
import { Calculator, BarChart3, Target, Navigation, Home, Settings as SettingsIcon } from 'lucide-react';

type Tab = 'home' | 'input' | 'ride' | 'goals' | 'history' | 'settings';

export default function Index() {
  const [tab, setTab] = useState<Tab>('home');
  const [result, setResult] = useState<DailyEntry | null>(null);
  const [refresh, setRefresh] = useState(0);

  const handleCalculate = (entry: DailyEntry) => {
    setResult(entry);
    setRefresh(p => p + 1);
  };

  const triggerRefresh = () => setRefresh(p => p + 1);

  const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
    { key: 'home', label: 'Início', icon: Home },
    { key: 'input', label: 'Calcular', icon: Calculator },
    { key: 'ride', label: 'Corrida', icon: Navigation },
    { key: 'goals', label: 'Metas', icon: Target },
    { key: 'history', label: 'Histórico', icon: BarChart3 },
  ];

  const tabClass = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 text-[10px] font-display font-semibold transition-colors rounded-md min-w-0 flex-1 ${
      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-card border-b px-4 pt-6 pb-4">
        <div className="container max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Visionario Delivery Pro</h1>
            <p className="text-xs text-muted-foreground">Lucro real · Decisão rápida · Foco</p>
          </div>
          <button
            onClick={() => setTab('settings')}
            className="p-2 rounded-lg bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Configurações"
          >
            <SettingsIcon size={20} />
          </button>
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
            </button>
          ))}
        </nav>

        {tab === 'home' && (
          <Dashboard
            refresh={refresh}
            onGoToInput={() => setTab('input')}
            onGoToGoals={() => setTab('goals')}
          />
        )}
        {tab === 'input' && !result && <DailyInputForm onCalculate={handleCalculate} />}
        {tab === 'input' && result && <ResultsView entry={result} onBack={() => setResult(null)} />}
        {tab === 'ride' && <RideAnalyzer refresh={refresh} />}
        {tab === 'goals' && <GoalsView refresh={refresh} onSaved={triggerRefresh} />}
        {tab === 'history' && <HistoryView refresh={refresh} onRefresh={triggerRefresh} />}
        {tab === 'settings' && <SettingsView refresh={refresh} onChanged={triggerRefresh} />}
      </main>
    </div>
  );
}
