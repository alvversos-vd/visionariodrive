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
import { Plus, Trash2, Sparkles, Receipt, Banknote } from 'lucide-react';
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
    <div className="space-y-4 animate-slide-up">
      {/* Header estilo extrato bancário — saldo do mês em destaque */}
      <div className="card-premium relative overflow-hidden p-5 animate-fade-in-up">
        <div className="absolute inset-x-0 top-0 h-px bg-primary/60" />
        <p className="text-micro uppercase tracking-[0.22em] text-muted-foreground font-display font-semibold">
          Saldo financeiro · este mês
        </p>
        <p className={`kpi-display mt-2 text-[36px] ${monthNet >= 0 ? 'text-foreground' : 'text-loss'}`}>
          {monthNet >= 0 ? '' : '−'}{fmt(Math.abs(monthNet))}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 divide-x divide-border/60">
          <StatCell label="Bônus"    value={fmt(monthMetrics.bonus)}    tone="profit" />
          <StatCell label="Receitas" value={fmt(monthMetrics.income)}   tone="profit" />
          <StatCell label="Despesas" value={fmt(monthMetrics.expense)}  tone="loss" />
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
              <EmptyState
                icon={<Icon size={22} />}
                title={meta.empty}
                description="Toque no botão acima para registrar o primeiro."
              />
            ) : (
              <div className="card-premium overflow-hidden">
                {grouped.map((group, gi) => (
                  <div key={group.date}>
                    {gi > 0 && <div className="divider-hairline" />}
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                      <p className="text-micro uppercase tracking-[0.14em] text-muted-foreground font-display font-semibold">
                        {fmtDate(group.date)}
                      </p>
                      <p className={`text-caption font-mono-num ${TAB_META[t].color}`}>
                        {TAB_META[t].sign}{fmt(group.items.reduce((s, e) => s + e.value, 0))}
                      </p>
                    </div>
                    {group.items.map((e, i) => {
                      const em = TAB_META[e.type];
                      const IconRow = em.icon;
                      return (
                        <div key={e.id}>
                          {i > 0 && <div className="mx-4 divider-hairline" />}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="h-8 w-8 rounded-lg surface-inset flex items-center justify-center shrink-0">
                              <IconRow size={14} className={em.color} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-display font-semibold text-foreground truncate">
                                {e.category}
                              </p>
                              <p className="text-caption text-muted-foreground truncate mt-0.5">
                                {e.app && <>{e.app}</>}
                                {e.app && e.notes && <> · </>}
                                {e.notes}
                                {!e.app && !e.notes && <span className="italic opacity-70">Sem detalhes</span>}
                              </p>
                            </div>
                            <p className={`font-mono-num font-semibold text-base shrink-0 tracking-tight ${em.color}`}>
                              {em.sign}{fmt(e.value)}
                            </p>
                            <button
                              onClick={() => handleRemove(e.id)}
                              className="p-1.5 -mr-1.5 text-muted-foreground/70 hover:text-destructive transition-colors press"
                              aria-label="Remover"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

function StatCell({ label, value, tone }: { label: string; value: string; tone: 'profit' | 'loss' | 'neutral' }) {
  const color = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : 'text-foreground';
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p className="text-micro uppercase tracking-wider text-muted-foreground font-display font-semibold">{label}</p>
      <p className={`mt-1 text-base font-display font-semibold font-mono-num ${color}`}>{value}</p>
    </div>
  );
}
