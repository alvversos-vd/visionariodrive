/**
 * Painéis do CRM Intelligence — Sprint 8.
 *
 * Camada de apresentação pura. Recebem `CrmAnalytics` por prop
 * (produzido por crmService → crmAnalyticsService). Nenhum acesso a
 * Repository, Supabase, storage ou regra de negócio aqui.
 */
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  CrmAnalytics,
  CrmAlert,
  CrmHealthArea,
  CrmHeatCell,
} from '@/lib/services/crmAnalyticsService';

const intFmt = new Intl.NumberFormat('pt-BR');
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (n: number) => intFmt.format(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(0)}%`;

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{children}</h2>
      {hint && <p className="text-caption text-muted-foreground/70 mt-0.5">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="premium" className="p-3">
      <p className="text-micro uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-display font-bold number-tabular mt-1">{value}</p>
    </Card>
  );
}

/* ── Fase 1 · Engajamento ── */
export function CrmEngagementPanel({ data }: { data: CrmAnalytics }) {
  const e = data.engagement;
  return (
    <section>
      <SectionTitle hint="Média por turno registrado na base.">Engajamento</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Turnos iniciados" value={fmtInt(e.shiftsStarted)} />
        <Stat label="Turnos finalizados" value={fmtInt(e.shiftsEnded)} />
        <Stat label="Conclusão de turno" value={fmtPct(e.shiftCompletionPct)} />
        <Stat label="Tempo médio/turno" value={`${fmtInt(e.avgShiftMinutes)} min`} />
        <Stat label="Corridas por turno" value={e.avgRidesPerShift.toFixed(1)} />
        <Stat label="Km médios/turno" value={`${e.avgKmPerShift.toFixed(1)} km`} />
        <Stat label="Lucro médio/turno" value={brl.format(e.avgProfitPerShift)} />
      </div>
    </section>
  );
}

/* ── Fase 1 · Retenção ── */
export function CrmRetentionPanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Usuários ativos exatamente no dia N após o cadastro.">Retenção</SectionTitle>
      <Card variant="premium" className="p-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {data.retention.map(r => (
            <div key={r.label} className="text-center">
              <p className="text-micro uppercase tracking-wider text-muted-foreground">{r.label}</p>
              <p className={`text-xl font-display font-bold number-tabular ${r.pct >= 25 ? 'text-profit' : r.pct > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                {r.eligible > 0 ? fmtPct(r.pct) : '—'}
              </p>
              <p className="text-micro text-muted-foreground number-tabular">{r.retained}/{r.eligible}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

/* ── Fase 2 · Funil ── */
export function CrmFunnelPanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Instalações não são rastreadas; o funil começa na criação de conta.">Funil do usuário</SectionTitle>
      <Card variant="premium" className="p-4 space-y-3">
        {data.funnel.map((s, i) => (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm">{s.label}</span>
              <span className="text-sm font-display font-semibold number-tabular">
                {fmtInt(s.users)}
                <span className="text-caption text-muted-foreground ml-1">({fmtPct(s.pctOfTop)})</span>
              </span>
            </div>
            <div className="h-2 mt-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary animate-bar-fill" style={{ width: `${Math.max(2, s.pctOfTop)}%` }} />
            </div>
            {i > 0 && s.dropFromPrevPct > 0 && (
              <p className="text-micro text-muted-foreground mt-1">−{s.dropFromPrevPct.toFixed(0)}% em relação à etapa anterior</p>
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}

/* ── Fase 3 · Heatmaps ── */
function HeatRow({ cells, compact }: { cells: CrmHeatCell[]; compact?: boolean }) {
  return (
    <div className={`grid gap-1 ${compact ? 'grid-cols-12' : 'grid-cols-7'}`}>
      {cells.map(c => (
        <div key={c.key} className="text-center">
          <div
            className="rounded-md h-10 flex items-center justify-center text-micro number-tabular"
            style={{
              backgroundColor: `hsl(var(--primary) / ${(0.08 + (c.pct / 100) * 0.72).toFixed(3)})`,
              color: c.pct > 55 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            }}
          >
            {c.value > 0 ? fmtInt(c.value) : ''}
          </div>
          <p className="text-micro text-muted-foreground mt-1">{c.key}</p>
        </div>
      ))}
    </div>
  );
}

export function CrmHeatmapPanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Distribuição das corridas registradas.">Heatmaps de operação</SectionTitle>
      <div className="space-y-3">
        <Card variant="premium" className="p-4">
          <p className="text-micro uppercase tracking-wider text-muted-foreground mb-2">Dias da semana</p>
          <HeatRow cells={data.weekdayHeat} />
        </Card>
        <Card variant="premium" className="p-4">
          <p className="text-micro uppercase tracking-wider text-muted-foreground mb-2">Horários</p>
          <HeatRow cells={data.hourHeat} compact />
        </Card>
      </div>
    </section>
  );
}

/* ── Fase 4 · Funcionalidades ── */
export function CrmFeatureUsagePanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Percentual de contas com dados reais de cada módulo.">Funcionalidades utilizadas</SectionTitle>
      <Card variant="premium" className="p-4 space-y-2.5">
        {data.featureUsage.map(f => (
          <div key={f.key}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm">{f.label}</span>
              <span className="text-caption number-tabular text-muted-foreground">{fmtInt(f.users)} · {fmtPct(f.pct)}</span>
            </div>
            <div className="h-1.5 mt-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary/70 animate-bar-fill" style={{ width: `${Math.max(1, f.pct)}%` }} />
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}

/* ── Fase 5 · Cohorts ── */
export function CrmCohortPanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Cada linha é uma semana de cadastro (ISO).">Cohorts semanais</SectionTitle>
      <Card variant="premium" className="p-4 overflow-x-auto">
        {data.cohorts.length === 0 ? (
          <p className="text-caption text-muted-foreground">Sem cohorts com dados suficientes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-micro uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium py-1">Semana</th>
                <th className="text-right font-medium">Usuários</th>
                <th className="text-right font-medium">D1</th>
                <th className="text-right font-medium">D7</th>
                <th className="text-right font-medium">D15</th>
                <th className="text-right font-medium">D30</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map(c => (
                <tr key={c.cohort} className="divider-hairline">
                  <td className="py-1.5 number-tabular">{c.cohort}</td>
                  <td className="text-right number-tabular">{fmtInt(c.size)}</td>
                  <td className="text-right number-tabular">{fmtPct(c.d1)}</td>
                  <td className="text-right number-tabular">{fmtPct(c.d7)}</td>
                  <td className="text-right number-tabular">{fmtPct(c.d15)}</td>
                  <td className="text-right number-tabular">{fmtPct(c.d30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}

/* ── Fase 6 · Saúde ── */
function healthBadge(status: CrmHealthArea['status']) {
  if (status === 'ok') return <Badge variant="success">Funcionando</Badge>;
  if (status === 'degraded') return <Badge variant="warning">Atenção</Badge>;
  if (status === 'failing') return <Badge variant="destructive">Falhando</Badge>;
  return <Badge variant="secondary">Sem instrumentação</Badge>;
}

export function CrmHealthPanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Áreas marcadas como 'sem instrumentação' dependem de telemetria remota (ainda local no device).">
        Saúde do aplicativo
      </SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.health.map(h => (
          <Card key={h.key} variant="premium" className="p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-display font-semibold">{h.label}</span>
              {healthBadge(h.status)}
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-caption text-muted-foreground">{h.detail}</p>
              {h.pct !== null && <span className="text-sm font-display font-bold number-tabular">{fmtPct(h.pct)}</span>}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ── Fase 7 · Conquistas ── */
export function CrmAchievementsPanel({ data }: { data: CrmAnalytics }) {
  const unlocked = data.achievements.filter(a => a.users > 0);
  const dead = data.achievements.filter(a => a.users === 0);
  return (
    <section>
      <SectionTitle hint="Base para calibrar XP e dificuldade.">Ranking de conquistas</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card variant="premium" className="p-4 space-y-2">
          <p className="text-micro uppercase tracking-wider text-muted-foreground">Mais desbloqueadas</p>
          {unlocked.length === 0 && <p className="text-caption text-muted-foreground">Nenhuma conquista desbloqueada ainda.</p>}
          {unlocked.slice(0, 10).map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <span className="text-sm truncate">{a.icon} {a.name}</span>
              <span className="text-caption number-tabular text-muted-foreground shrink-0">{fmtInt(a.users)} · {fmtPct(a.pct)}</span>
            </div>
          ))}
        </Card>
        <Card variant="premium" className="p-4 space-y-2">
          <p className="text-micro uppercase tracking-wider text-muted-foreground">Nunca desbloqueadas ({dead.length})</p>
          {dead.length === 0 && <p className="text-caption text-muted-foreground">Todas as conquistas já foram alcançadas.</p>}
          {dead.slice(0, 12).map(a => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <span className="text-sm truncate text-muted-foreground">{a.icon} {a.name}</span>
              <span className="text-caption number-tabular text-muted-foreground shrink-0">{a.xp} XP</span>
            </div>
          ))}
        </Card>
      </div>
    </section>
  );
}

/* ── Fase 8 · Financeiro ── */
export function CrmRevenuePanel({ data }: { data: CrmAnalytics }) {
  const r = data.revenue;
  return (
    <section>
      <SectionTitle hint="Estrutura pronta para o PRO. Receita só é preenchida após integração de billing.">
        Painel financeiro
      </SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="FREE" value={fmtInt(r.free)} />
        <Stat label="PRO" value={fmtInt(r.pro)} />
        <Stat label="Conversão" value={fmtPct(r.conversionPct)} />
        <Stat label="Trials" value={r.instrumented ? fmtInt(r.trials) : '—'} />
        <Stat label="Cancelamentos" value={r.instrumented ? fmtInt(r.cancellations) : '—'} />
        <Stat label="MRR" value={r.instrumented ? brl.format(r.mrr) : '—'} />
        <Stat label="ARPU" value={r.instrumented ? brl.format(r.arpu) : '—'} />
      </div>
    </section>
  );
}

/* ── Fase 9 · Alertas ── */
function alertTone(sev: CrmAlert['severity']): string {
  if (sev === 'critical') return 'border-destructive/40 text-destructive';
  if (sev === 'warning') return 'border-warning/40 text-warning';
  if (sev === 'positive') return 'border-primary/40 text-primary';
  return 'border-border text-muted-foreground';
}

export function CrmAlertsPanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Sinais gerados a partir do funil, retenção e uso.">Alertas inteligentes</SectionTitle>
      <div className="space-y-2">
        {data.alerts.length === 0 && (
          <Card variant="premium" className="p-3 text-caption text-muted-foreground">Nenhum sinal crítico no momento.</Card>
        )}
        {data.alerts.map(a => (
          <Card key={a.id} className={`p-3 text-sm border ${alertTone(a.severity)}`}>
            {a.severity === 'positive' ? '▲' : a.severity === 'info' ? 'ℹ' : '⚠'} {a.message}
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ── Fase 10 · Roadmap ── */
export function CrmRoadmapPanel({ data }: { data: CrmAnalytics }) {
  return (
    <section>
      <SectionTitle hint="Prioridades sugeridas pelo maior gargalo observado.">Roadmap insights</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.roadmap.length === 0 && (
          <Card variant="premium" className="p-3 text-caption text-muted-foreground">Sem gargalos relevantes detectados.</Card>
        )}
        {data.roadmap.map(r => (
          <Card key={r.id} variant="highlight" className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-bold">{r.title}</p>
              <Badge variant={r.priority === 'Alta' ? 'destructive' : r.priority === 'Média' ? 'warning' : 'secondary'}>
                {r.priority}
              </Badge>
            </div>
            <p className="text-caption text-muted-foreground mt-1.5">Gargalo: {r.bottleneck}</p>
            <p className="text-caption text-primary mt-0.5">Impacto: {r.impact}</p>
            <p className="text-sm mt-2">{r.suggestion}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
