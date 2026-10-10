/**
 * FinancialView — aba "Financeiro" do START.
 *
 * Sprint 7.5 Onda 3 — Estilo bancário:
 * timeline hairline por linha, valor tabular à direita,
 * ícone monocromo à esquerda, categoria + metadados no meio.
 *
 * Componente puramente apresentacional: lê via FinancialService,
 * dispara mutations via FinancialService. Nenhuma regra de cálculo aqui.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Sparkles, Receipt, Banknote, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { financialService } from '@/lib/services/financialService';
import { metricsService } from '@/lib/services/metricsService';
import type { FinancialEntry, FinancialType } from '@/lib/domain/models';
import EntryForm from './financial/EntryForm';
import { EmptyState } from '@/components/ui/empty-state';

interface Props {
  refresh: number;
  onChanged: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function groupByDate(entries: FinancialEntry[]): Array<{ date: string; items: FinancialEntry[] }> {
  const map = new Map<string, FinancialEntry[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 10);
    const bucket = map.get(key) ?? [];
    bucket.push(e);
    map.set(key, bucket);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

const TAB_META: Record<FinancialType, { label: string; icon: typeof Sparkles; empty: string; cta: string; sign: '+' | '−'; color: string }> = {
  bonus:   { label: 'Bônus',           icon: Sparkles, empty: 'Nenhum bônus registrado',          cta: 'Adicionar bônus',   sign: '+', color: 'text-profit' },
  expense: { label: 'Despesas',        icon: Receipt,  empty: 'Nenhuma despesa registrada',       cta: 'Adicionar despesa', sign: '−', color: 'text-loss' },
  income:  { label: 'Outras receitas', icon: Banknote, empty: 'Nenhuma receita extra registrada', cta: 'Adicionar receita', sign: '+', color: 'text-profit' },
};

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
}

export default function FinancialView({ refresh, onChanged }: Props) {
  const [tab, setTab] = useState<FinancialType>('bonus');
  const [formOpen, setFormOpen] = useState(false);

  const monthMetrics = useMemo(
    () => { void refresh; return metricsService.rangeMetrics(startOfMonth(), new Date()); },
    [refresh],
  );

  const entries = useMemo<FinancialEntry[]>(
    () => { void refresh; return financialService.list({ type: tab }); },
    [refresh, tab],
  );

  const grouped = useMemo(() => groupByDate(entries), [entries]);

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
  const monthNet = monthMetrics.bonus + monthMetrics.income - monthMetrics.expense;

  return (
    <div className="min-w-0 space-y-6 animate-slide-up">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-normal">Financeiro</h2>
        <p className="text-xs text-muted-foreground">Este mês</p>
      </header>

      {/* Os mesmos indicadores mensais, sem agregar receitas ou mudar o saldo. */}
      <section aria-label="Resumo financeiro do mês" className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-[1.2fr_1fr_1fr] sm:gap-x-3">
        <div className="col-span-2 min-w-0 border-t-2 border-primary pt-4 sm:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet size={15} aria-hidden="true" />
            <p className="text-xs font-medium">Saldo financeiro</p>
          </div>
          <p className={`font-mono-num mt-3 text-[28px] font-semibold leading-tight tracking-normal [overflow-wrap:anywhere] ${monthNet >= 0 ? 'text-foreground' : 'text-loss'}`}>
            {monthNet >= 0 ? '' : '−'}{fmt(Math.abs(monthNet))}
          </p>
        </div>
        <div className="min-w-0 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-1.5 text-profit">
            <ArrowDownLeft size={15} aria-hidden="true" />
            <p className="text-xs font-medium">Receitas</p>
          </div>
          <div className="space-y-3">
            <StatCell label="Bônus" value={fmt(monthMetrics.bonus)} tone="profit" />
            <StatCell label="Receitas" value={fmt(monthMetrics.income)} tone="profit" />
          </div>
        </div>
        <div className="min-w-0 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-1.5 text-muted-foreground">
            <ArrowUpRight size={15} aria-hidden="true" />
            <p className="text-xs font-medium">Despesas</p>
          </div>
          <StatCell label="Despesas" value={fmt(monthMetrics.expense)} tone="neutral" />
        </div>
      </section>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as FinancialType)}>
        <TabsList aria-label="Tipo de movimentação" className="grid h-auto w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="bonus"   className="min-h-11 min-w-0 px-2">Bônus</TabsTrigger>
          <TabsTrigger value="expense" className="min-h-11 min-w-0 px-2">Despesas</TabsTrigger>
          <TabsTrigger value="income"  className="min-h-11 min-w-0 px-2">Receitas</TabsTrigger>
        </TabsList>

        {(['bonus','expense','income'] as FinancialType[]).map(t => (
          <TabsContent key={t} value={t} className="mt-5 space-y-4">
            {entries.length === 0 ? (
              <EmptyState
                icon={<Icon size={22} />}
                title={meta.empty}
                className="py-8 [&_h3]:tracking-normal"
              />
            ) : (
              <div className="min-w-0">
                {grouped.map((group, gi) => (
                  <div key={group.date}>
                    {gi > 0 && <div className="divider-hairline" />}
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-muted/40 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground font-medium">
                        {fmtDate(group.date)}
                      </p>
                      <p className="min-w-0 text-xs font-mono-num text-muted-foreground [overflow-wrap:anywhere]">
                        {TAB_META[t].sign}{fmt(group.items.reduce((s, e) => s + e.value, 0))}
                      </p>
                    </div>
                    {group.items.map((e, i) => {
                      const em = TAB_META[e.type];
                      const IconRow = em.icon;
                      return (
                        <div key={e.id}>
                          {i > 0 && <div className="mx-4 divider-hairline" />}
                          <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-1 px-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,auto)_2.75rem] sm:gap-x-2">
                            <div className="h-8 w-8 rounded-lg surface-inset flex items-center justify-center">
                              <IconRow size={15} className="text-muted-foreground" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-display font-semibold text-foreground break-words">
                                {e.category}
                              </p>
                              <p className="text-xs leading-relaxed text-muted-foreground break-words mt-0.5">
                                {e.app && <>{e.app}</>}
                                {e.app && e.notes && <> · </>}
                                {e.notes}
                                {!e.app && !e.notes && <span className="italic opacity-70">Sem detalhes</span>}
                              </p>
                            </div>
                            <p className={`col-start-2 row-start-2 min-w-0 text-right font-mono-num font-semibold text-base tracking-normal [overflow-wrap:anywhere] sm:col-start-3 sm:row-start-1 ${em.color}`}>
                              {em.sign}{fmt(e.value)}
                            </p>
                            <Button
                              onClick={() => handleRemove(e.id)}
                              variant="ghost"
                              size="icon"
                              className="col-start-3 row-start-1 h-11 w-11 text-muted-foreground hover:text-destructive sm:col-start-4"
                              aria-label="Remover"
                              title={`Remover ${e.category}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            <Button
              onClick={() => setFormOpen(true)}
              className="w-full press"
              variant="default"
            >
              <Plus size={16} /> {TAB_META[t].cta}
            </Button>
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

function StatCell({ label, value, tone }: { label: string; value: string; tone: 'profit' | 'loss' | 'neutral' }) {
  const color = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-foreground';
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base leading-relaxed font-semibold font-mono-num tracking-normal [overflow-wrap:anywhere] ${color}`}>{value}</p>
    </div>
  );
}
