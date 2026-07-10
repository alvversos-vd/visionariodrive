/**
 * FinancialView — aba "Financeiro" do START.
 *
 * Substitui a antiga "Gastos". Componente puramente apresentacional:
 * lê via FinancialService, dispara mutations via FinancialService.
 * Nenhuma regra de cálculo financeiro aqui.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Sparkles, Receipt, Banknote } from 'lucide-react';
import { financialService } from '@/lib/services/financialService';
import { metricsService } from '@/lib/services/metricsService';
import type { FinancialEntry, FinancialType } from '@/lib/domain/models';
import EntryForm from './financial/EntryForm';

interface Props {
  refresh: number;
  onChanged: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const TAB_META: Record<FinancialType, { label: string; icon: typeof Sparkles; empty: string; cta: string }> = {
  bonus:   { label: 'Bônus',          icon: Sparkles, empty: 'Nenhum bônus registrado',          cta: 'Adicionar bônus' },
  expense: { label: 'Despesas',       icon: Receipt,  empty: 'Nenhuma despesa registrada',       cta: 'Adicionar despesa' },
  income:  { label: 'Outras receitas',icon: Banknote, empty: 'Nenhuma receita extra registrada', cta: 'Adicionar receita' },
};

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

export default function FinancialView({ refresh, onChanged }: Props) {
  const [tab, setTab] = useState<FinancialType>('bonus');
  const [formOpen, setFormOpen] = useState(false);

  // Métricas do período (via MetricsService)
  const monthMetrics = useMemo(
    () => { void refresh; return metricsService.rangeMetrics(startOfMonth(), new Date()); },
    [refresh],
  );

  // Listagem da aba ativa (via FinancialService)
  const entries = useMemo<FinancialEntry[]>(
    () => { void refresh; return financialService.list({ type: tab }); },
    [refresh, tab],
  );

  const handleSubmit = (payload: { type: FinancialType; value: number; category: string; app?: FinancialEntry['app']; notes?: string }) => {
    financialService.add({
      type: payload.type,
      value: payload.value,
      category: payload.category,
      app: payload.app,
      notes: payload.notes,
      origin: 'manual',
    });
    toast.success(`${TAB_META[payload.type].label} registrado`);
    onChanged();
  };

  const handleRemove = (id: string) => {
    const entry = entries.find(e => e.id === id);
    financialService.remove(id);
    toast.success(entry ? `${TAB_META[entry.type].label} removido` : 'Removido');
    onChanged();
  };

  const meta = TAB_META[tab];
  const Icon = meta.icon;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Header / KPIs do mês */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-card border border-border/70 shadow-premium">
        <div className="absolute inset-x-0 top-0 h-px bg-primary/60" />
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-display font-semibold">
          Financeiro · este mês
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Kpi label="Bônus"    value={fmt(monthMetrics.bonus)}    tone="profit" />
          <Kpi label="Despesas" value={fmt(monthMetrics.expense)}  tone="loss" />
          <Kpi label="Receitas" value={fmt(monthMetrics.income)}   tone="neutral" />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as FinancialType)}>
        <TabsList className="w-full">
          <TabsTrigger value="bonus"   className="flex-1">Bônus</TabsTrigger>
          <TabsTrigger value="expense" className="flex-1">Despesas</TabsTrigger>
          <TabsTrigger value="income"  className="flex-1">Receitas</TabsTrigger>
        </TabsList>

        {(['bonus','expense','income'] as FinancialType[]).map(t => (
          <TabsContent key={t} value={t} className="mt-4 space-y-3">
            <Button
              onClick={() => setFormOpen(true)}
              className="w-full press"
              variant="default"
            >
              <Plus size={16} className="mr-1.5" /> {TAB_META[t].cta}
            </Button>

            {entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon size={32} className="mx-auto mb-2 opacity-60" />
                <p className="text-sm font-display font-semibold">{meta.empty}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map(e => (
                  <div key={e.id} className="bg-card rounded-xl p-3.5 border border-border/70 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-display font-bold font-mono-num ${
                          e.type === 'expense' ? 'text-loss' : 'text-profit'
                        }`}>
                          {e.type === 'expense' ? '−' : '+'}{fmt(e.value)}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                          {e.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {fmtDate(e.date)}
                        {e.app && <> · {e.app}</>}
                        {e.notes && <> · {e.notes}</>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(e.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors press"
                      aria-label="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <EntryForm
        open={formOpen}
        type={tab}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'profit' | 'loss' | 'neutral' }) {
  const color = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-foreground';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display font-semibold">{label}</p>
      <p className={`mt-1 text-lg font-display font-bold font-mono-num ${color}`}>{value}</p>
    </div>
  );
}
