import { useState } from 'react';
import { DailyEntry } from '@/lib/types';
import DailyInputForm from '@/components/DailyInputForm';
import ResultsView from '@/components/ResultsView';
import HistoryView from '@/components/HistoryView';
import RideAnalyzer from '@/components/RideAnalyzer';
import GoalSetting from '@/components/GoalSetting';
import { Calculator, BarChart3, Target, Navigation } from 'lucide-react';

type Tab = 'input' | 'ride' | 'history';

export default function Index() {
  const [tab, setTab] = useState<Tab>('input');
  const [result, setResult] = useState<DailyEntry | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [showGoal, setShowGoal] = useState(false);

  const handleCalculate = (entry: DailyEntry) => {
    setResult(entry);
    setHistoryRefresh(p => p + 1);
  };

  const tabClass = (t: Tab) =>
    `flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-display font-semibold transition-colors rounded-lg ${
      tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-card border-b px-4 pt-6 pb-4">
        <div className="container max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Lucro Delivery Pro</h1>
            <p className="text-xs text-muted-foreground">Calculadora de lucro real</p>
          </div>
          <button
            onClick={() => setShowGoal(v => !v)}
            className="p-2 rounded-lg bg-secondary text-foreground hover:bg-accent transition-colors"
          >
            <Target size={20} />
          </button>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 mt-4 space-y-4">
        {showGoal && <GoalSetting />}

        <div className="flex bg-secondary rounded-lg p-1 gap-1">
          <button className={tabClass('input')} onClick={() => { setTab('input'); setResult(null); }}>
            <Calculator size={14} /> Calcular
          </button>
          <button className={tabClass('ride')} onClick={() => setTab('ride')}>
            <Navigation size={14} /> Corrida
          </button>
          <button className={tabClass('history')} onClick={() => setTab('history')}>
            <BarChart3 size={14} /> Histórico
          </button>
        </div>

        {tab === 'input' && !result && <DailyInputForm onCalculate={handleCalculate} />}
        {tab === 'input' && result && <ResultsView entry={result} onBack={() => setResult(null)} />}
        {tab === 'ride' && <RideAnalyzer refresh={historyRefresh} />}
        {tab === 'history' && <HistoryView refresh={historyRefresh} onRefresh={() => setHistoryRefresh(p => p + 1)} />}
      </main>
    </div>
  );
}
