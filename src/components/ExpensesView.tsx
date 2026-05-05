import { useMemo, useState } from 'react';
import {
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  addExpense,
  deleteExpense,
  getExpenses,
  getTodayExpenses,
  groupByCategory,
  sumExpenses,
  sumLastNDays,
} from '@/lib/expenses';
import { getEntries } from '@/lib/storage';
import { toast } from 'sonner';
import { Trash2, Utensils, Wrench, AlertTriangle, Car, MoreHorizontal } from 'lucide-react';

interface Props {
  refresh: number;
  onChanged: () => void;
}

const CATEGORY_ICON: Record<ExpenseCategory, typeof Utensils> = {
  'Alimentação': Utensils,
  'Manutenção': Wrench,
  'Emergência': AlertTriangle,
  'Transporte': Car,
  'Outros': MoreHorizontal,
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default function ExpensesView({ refresh, onChanged }: Props) {
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Alimentação');
  const [description, setDescription] = useState('');

  const all = useMemo(() => getExpenses(), [refresh]);
  const today = useMemo(() => getTodayExpenses(all), [all]);
  const todayTotal = sumExpenses(today);
  const byCat = useMemo(() => groupByCategory(today), [today]);

  const entries = useMemo(() => getEntries(), [refresh]);
  const todayEntry = entries.find(e => isSameDay(new Date(e.date), new Date()));
  const earningsToday = todayEntry?.totalEarnings ?? 0;
  const profitToday = todayEntry ? todayEntry.profit - todayTotal : -todayTotal;

  const weekTotal = sumLastNDays(all, 7);
  const monthTotal = sumLastNDays(all, 30);

  const insights: string[] = [];
  if (earningsToday > 0 && todayTotal > earningsToday * 0.2) {
    insights.push('⚠️ Seus gastos estão altos hoje (>20% dos ganhos).');
  }
  if (todayTotal > 0 && byCat['Alimentação'].total > todayTotal * 0.4) {
    insights.push('🍔 Você está gastando muito com alimentação.');
  }
  if (byCat['Manutenção'].count > 2) {
    insights.push('🔧 Seu veículo está gerando muitos custos hoje.');
  }

  const submit = () => {
    const v = parseFloat(value.replace(',', '.'));
    if (!v || v <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    addExpense({ value: v, category, description });
    setValue('');
    setDescription('');
    toast.success('Gasto registrado');
    onChanged();
  };

  const remove = (id: string) => {
    deleteExpense(id);
    onChanged();
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Quick add */}
      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <h2 className="font-display font-bold text-foreground">+ Novo gasto</h2>

        <div className="grid grid-cols-5 gap-2">
          {EXPENSE_CATEGORIES.map(c => {
            const Icon = CATEGORY_ICON[c];
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-semibold transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                <Icon size={16} />
                <span className="truncate w-full text-center">{c}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 bg-background border rounded-lg px-3 py-2 text-foreground"
          />
          <button
            onClick={submit}
            className="bg-primary text-primary-foreground font-display font-bold px-4 rounded-lg hover:opacity-90"
          >
            Salvar
          </button>
        </div>

        <input
          type="text"
          placeholder="Descrição (opcional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full bg-background border rounded-lg px-3 py-2 text-foreground text-sm"
        />
      </div>

      {/* Resumo do dia */}
      <div className="bg-card rounded-lg p-4 border shadow-sm">
        <p className="text-xs text-muted-foreground">💸 Gastos extras de hoje</p>
        <p className="text-3xl font-display font-bold text-loss">{fmt(todayTotal)}</p>
        {todayEntry && todayTotal > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Reduziram seu lucro em <span className="font-bold text-loss">{fmt(todayTotal)}</span> hoje
            {' · '}Lucro ajustado: <span className={`font-bold ${profitToday >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(profitToday)}</span>
          </p>
        )}
      </div>

      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((t, i) => (
            <div key={i} className="bg-accent/10 border border-accent/30 text-accent-foreground rounded-lg p-3 text-sm font-medium">
              {t}
            </div>
          ))}
        </div>
      )}

      {/* Por categoria */}
      {todayTotal > 0 && (
        <div className="bg-card rounded-lg p-4 border shadow-sm space-y-2">
          <h3 className="font-display font-bold text-foreground mb-1">Por categoria</h3>
          {EXPENSE_CATEGORIES.filter(c => byCat[c].total > 0).map(c => {
            const pct = (byCat[c].total / todayTotal) * 100;
            const Icon = CATEGORY_ICON[c];
            return (
              <div key={c}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Icon size={14} /> {c}
                  </span>
                  <span className="font-semibold text-foreground">
                    {fmt(byCat[c].total)} <span className="text-muted-foreground text-xs">({pct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mt-1 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista detalhada do dia */}
      {today.length > 0 && (
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <h3 className="font-display font-bold text-foreground mb-2">Gastos de hoje</h3>
          <ul className="divide-y divide-border">
            {today.map(e => (
              <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {e.description || e.category}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{e.category}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-display font-bold text-loss">{fmt(e.value)}</span>
                  <button
                    onClick={() => remove(e.id)}
                    aria-label="Remover"
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-loss"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Histórico semanal/mensal */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          <p className="text-lg font-display font-bold text-foreground">{fmt(weekTotal)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          <p className="text-lg font-display font-bold text-foreground">{fmt(monthTotal)}</p>
        </div>
      </div>
    </div>
  );
}
