import { useMemo, useState } from 'react';
import {
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  addExpense,
  deleteExpense,
} from '@/lib/expenses';
import { getGoals, saveGoals } from '@/lib/storage';
import { computeExpenseAnalytics } from '@/lib/expenseAnalytics';
import { toast } from 'sonner';
import {
  Trash2, Utensils, Wrench, AlertTriangle, Car, MoreHorizontal,
  TrendingUp, TrendingDown, Flame, Trophy, Receipt, Fuel,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Props {
  refresh: number;
  onChanged: () => void;
}

const CATEGORY_ICON: Record<ExpenseCategory, typeof Utensils> = {
  'Alimentação': Utensils,
  'Manutenção': Wrench,
  'Pedágio': Receipt,
  'Combustível extra': Fuel,
  'Emergência': AlertTriangle,
  'Transporte': Car,
  'Outros': MoreHorizontal,
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type WindowDays = 7 | 30 | 90;

export default function ExpensesView({ refresh, onChanged }: Props) {
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Alimentação');
  const [description, setDescription] = useState('');
  const [windowDays, setWindowDays] = useState<WindowDays>(7);

  const goals = useMemo(() => getGoals(), [refresh]);
  const savingsGoal = goals.savingsDaily ?? 0;
  const [savingsInput, setSavingsInput] = useState(String(savingsGoal || ''));

  const a = useMemo(
    () => computeExpenseAnalytics(savingsGoal, windowDays),
    [refresh, savingsGoal, windowDays],
  );

  const todayTotal = a.todayTotal;
  const byCat = a.byCategoryToday;
  const byCatWindow = a.byCategoryWindow;
  const windowLabel = `${windowDays} dias`;
  const profitAdjusted = a.todayEntry ? a.todayEntry.profit - todayTotal : -todayTotal;
  const savings = savingsGoal - todayTotal;
  const dayStatus = savingsGoal > 0
    ? (todayTotal <= savingsGoal ? 'controlado' : 'atenção')
    : null;

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

  const saveSavings = () => {
    const v = parseFloat(savingsInput.replace(',', '.')) || 0;
    saveGoals({ ...goals, savingsDaily: v });
    toast.success('Meta de economia salva');
    onChanged();
  };

  // Insights / alerts
  const alerts: { tone: 'loss' | 'accent' | 'profit'; text: string }[] = [];

  if (a.earningsToday > 0 && todayTotal > a.earningsToday * 0.3) {
    alerts.push({ tone: 'loss', text: '🚨 Seus gastos estão comprometendo seu lucro hoje.' });
  } else if (a.earningsToday > 0 && todayTotal > a.earningsToday * 0.2) {
    alerts.push({ tone: 'accent', text: '⚠️ Seus gastos estão altos hoje (>20% dos ganhos).' });
  }
  if (todayTotal > 0 && byCat['Alimentação'].total > todayTotal * 0.4) {
    alerts.push({ tone: 'accent', text: '🍔 Você está gastando muito com alimentação.' });
  }
  if (byCat['Manutenção'].count > 2) {
    alerts.push({ tone: 'accent', text: '🔧 Seu veículo está gerando muitos custos hoje.' });
  }
  if (a.outOfPattern.length > 0) {
    alerts.push({
      tone: 'accent',
      text: `📈 ${a.outOfPattern.length} gasto${a.outOfPattern.length > 1 ? 's' : ''} acima do seu padrão diário.`,
    });
  }
  for (const r of a.recurringGroups) {
    const label = r.label.length > 30 ? r.label.slice(0, 30) + '…' : r.label;
    alerts.push({
      tone: 'accent',
      text: `🔁 “${label}” (${r.category}) repetiu ${r.days}× nos últimos ${a.windowDays} dias · média ${fmt(r.avg)}.`,
    });
  }
  if (a.consciousnessMode) {
    alerts.push({
      tone: 'loss',
      text: '👁️ Modo consciência: você está trabalhando, mas não está guardando dinheiro. Revise seus gastos para aumentar seu lucro.',
    });
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Quick add */}
      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <h2 className="font-display font-bold text-foreground">+ Novo gasto</h2>

        <div className="grid grid-cols-4 gap-2">
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
        {a.todayEntry && todayTotal > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Reduziram seu lucro em <span className="font-bold text-loss">{fmt(a.profitImpact)}</span>
            {' · '}Lucro ajustado:{' '}
            <span className={`font-bold ${profitAdjusted >= 0 ? 'text-profit' : 'text-loss'}`}>
              {fmt(profitAdjusted)}
            </span>
          </p>
        )}
        {a.profile && (
          <p className="text-xs mt-2">
            🧠 Seu perfil hoje: <span className="font-semibold text-foreground">{a.profile}</span>
          </p>
        )}
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((al, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 text-sm font-medium border ${
                al.tone === 'loss' ? 'bg-loss/10 border-loss/30 text-loss' :
                al.tone === 'profit' ? 'bg-profit/10 border-profit/30 text-profit' :
                'bg-accent/10 border-accent/30 text-accent-foreground'
              }`}
            >
              {al.text}
            </div>
          ))}
        </div>
      )}

      {/* Meta de economia */}
      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold text-foreground">🎯 Meta de economia diária</p>
          {dayStatus && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              dayStatus === 'controlado' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
            }`}>
              {dayStatus === 'controlado' ? '✓ Controle total' : '⚠️ Atenção'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={savingsInput}
            onChange={e => setSavingsInput(e.target.value)}
            className="flex-1 bg-background border rounded-lg px-3 py-2 text-foreground"
          />
          <button
            onClick={saveSavings}
            className="bg-secondary text-foreground font-display font-semibold px-4 rounded-lg hover:bg-accent hover:text-accent-foreground"
          >
            Salvar
          </button>
        </div>
        {savingsGoal > 0 && (
          <p className="text-sm">
            {savings >= 0 ? (
              <span className="text-profit font-display font-bold">
                ✓ Você economizou {fmt(savings)} hoje
              </span>
            ) : (
              <span className="text-loss font-display font-bold">
                ⚠️ Ultrapassou a meta em {fmt(-savings)}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Filtro de período */}
      <div className="flex items-center justify-between bg-card border rounded-lg p-1.5">
        <span className="text-xs text-muted-foreground px-2">Período</span>
        <div className="flex gap-1">
          {([7, 30, 90] as WindowDays[]).map(d => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`text-xs font-display font-semibold px-3 py-1.5 rounded-md transition-colors ${
                windowDays === d
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Comparativo + previsão */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {a.weekVariation >= 0 ? <TrendingUp size={12} className="text-loss" /> : <TrendingDown size={12} className="text-profit" />}
            {windowLabel} vs anterior
          </p>
          <p className={`text-lg font-display font-bold ${a.weekVariation >= 0 ? 'text-loss' : 'text-profit'}`}>
            {a.weekVariationPct === null
              ? fmt(a.weekTotal)
              : `${a.weekVariation >= 0 ? '+' : ''}${a.weekVariationPct.toFixed(0)}%`}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {fmt(a.weekTotal)} vs {fmt(a.prevWeekTotal)}
          </p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-muted-foreground">🔮 Previsão semanal</p>
          <p className="text-lg font-display font-bold text-foreground">{fmt(a.weekForecast)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Média de {fmt(a.dailyAvg)}/dia ({windowLabel})
          </p>
        </div>
      </div>

      {/* Tendência — gastos */}
      <div className="bg-card rounded-lg p-4 border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-foreground">📈 Gastos · últimos {windowDays} dias</h3>
          <span className="text-xs text-muted-foreground">{fmt(a.weekTotal)}</span>
        </div>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={a.weekSeries} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--loss))" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(var(--loss))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => fmt(v)}
                labelFormatter={(l) => `Dia: ${l}`}
              />
              <Area type="monotone" dataKey="expenses" stroke="hsl(var(--loss))" fill="url(#expGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tendência de economia */}
      {savingsGoal > 0 && (
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-foreground">💚 Economia diária</h3>
            <span className="text-xs text-muted-foreground">Meta {fmt(savingsGoal)}</span>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.weekSeries} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmt(v)}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar
                  dataKey="savings"
                  radius={[4, 4, 0, 0]}
                  fill="hsl(var(--profit))"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Barras positivas = economizou; negativas = ultrapassou a meta.
          </p>
        </div>
      )}


      {savingsGoal > 0 && (a.controlStreak > 0 || a.bestSavingsDay) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
            <Flame size={18} className="mx-auto text-accent mb-0.5" />
            <p className="text-[10px] text-muted-foreground">Sequência controlada</p>
            <p className="font-display font-bold text-foreground">{a.controlStreak}d</p>
          </div>
          <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
            <Trophy size={18} className="mx-auto text-accent mb-0.5" />
            <p className="text-[10px] text-muted-foreground">Melhor economia</p>
            <p className="font-display font-bold text-profit">
              {a.bestSavingsDay ? fmt(a.bestSavingsDay.saved) : '—'}
            </p>
          </div>
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

      {/* Resumo semanal */}
      {(a.weekTotal > 0 || a.bestDayWeek || a.worstDayWeek) && (
        <div className="bg-card rounded-lg p-4 border shadow-sm space-y-1">
          <h3 className="font-display font-bold text-foreground mb-1">📊 Resumo da semana</h3>
          <p className="text-sm text-foreground">
            Total: <span className="font-bold">{fmt(a.weekTotal)}</span>
          </p>
          {a.dominantCategory && (
            <p className="text-sm text-muted-foreground">
              Categoria dominante hoje:{' '}
              <span className="font-semibold text-foreground">{a.dominantCategory}</span>
            </p>
          )}
          {a.bestDayWeek && (
            <p className="text-sm text-profit">
              ✓ Melhor dia: {a.bestDayWeek.day} ({fmt(a.bestDayWeek.total)})
            </p>
          )}
          {a.worstDayWeek && (
            <p className="text-sm text-loss">
              ⚠️ Pior dia: {a.worstDayWeek.day} ({fmt(a.worstDayWeek.total)})
            </p>
          )}
        </div>
      )}

      {/* Lista detalhada do dia */}
      {a.todayList.length > 0 && (
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <h3 className="font-display font-bold text-foreground mb-2">Gastos de hoje</h3>
          <ul className="divide-y divide-border">
            {a.todayList.map(e => {
              const isOut = a.outOfPattern.some(o => o.id === e.id);
              return (
                <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate flex items-center gap-1.5">
                      {e.description || e.category}
                      {isOut && (
                        <span className="text-[10px] bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded">
                          fora do padrão
                        </span>
                      )}
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
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
