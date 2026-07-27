/**
 * Painéis do Product Intelligence — Sprint 9.
 *
 * Camada de apresentação pura. Recebem `CrmIntelligence` por prop
 * (produzido por crmService → crmIntelligenceService). Nenhum acesso a
 * Repository, Supabase, storage ou regra de negócio aqui.
 */
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import type {
  CrmIntelligence,
  CrmDriverScore,
  CrmAdoptionTrend,
} from '@/lib/services/crmIntelligenceService';

const intFmt = new Intl.NumberFormat('pt-BR');
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

function tierBadge(tier: CrmDriverScore['tier']) {
  if (tier === 'excelente') return <Badge variant="success">Excelente</Badge>;
  if (tier === 'saudável') return <Badge variant="secondary">Saudável</Badge>;
  if (tier === 'atenção') return <Badge variant="warning">Atenção</Badge>;
  return <Badge variant="destructive">Crítico</Badge>;
}

/* ── Product Health ── */
export function CrmProductHealthPanel({ data }: { data: CrmIntelligence }) {
  const h = data.productHealth;
  const up = h.delta >= 0;
  return (
    <section>
      <SectionTitle hint="Índice ponderado das áreas instrumentadas. Crashes ainda não têm coleta remota.">
        Product Health
      </SectionTitle>
      <Card variant="highlight" className="p-4">
        <div className="flex items-end gap-3">
          <p className="text-4xl font-display font-bold number-tabular">{fmtPct(h.score)}</p>
          <span className={`flex items-center gap-1 text-sm number-tabular ${up ? 'text-profit' : 'text-destructive'}`}>
            {up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {`${up ? '+' : ''}${h.delta.toFixed(1)}%`}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {h.components.map(c => (
            <div key={c.key} className="divider-hairline pt-2">
              <p className="text-micro uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className="text-lg font-display font-bold number-tabular">
                {c.instrumented && c.value !== null ? fmtPct(c.value) : '—'}
              </p>
              <p className="text-micro text-muted-foreground">
                {c.instrumented ? `peso ${c.weight}%` : 'sem instrumentação'}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

/* ── Driver Score ── */
export function CrmDriverScorePanel({ data }: { data: CrmIntelligence }) {
  const top = data.scores.slice(0, 8);
  const bottom = data.scores.slice(-8).reverse().filter(s => !top.some(t => t.userId === s.userId));
  const row = (s: CrmDriverScore) => (
    <div key={s.userId} className="flex items-center justify-between gap-2 divider-hairline py-1.5">
      <div className="min-w-0">
        <p className="text-sm truncate">{s.alias}</p>
        <p className="text-micro text-muted-foreground">
          {s.lastActivityDays === null ? 'Sem atividade registrada' : `Ativo há ${s.lastActivityDays} dia(s)`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {tierBadge(s.tier)}
        <span className="text-lg font-display font-bold number-tabular">{fmtInt(s.score)}</span>
      </div>
    </div>
  );
  return (
    <section>
      <SectionTitle hint="Frequência, retenção, turnos, corridas, metas e XP. Não é ranking — serve para identificar risco.">
        Driver Score · média {fmtInt(data.avgScore)}
      </SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card variant="premium" className="p-4">
          <p className="text-micro uppercase tracking-wider text-muted-foreground mb-1">Mais saudáveis</p>
          {top.length === 0 && <p className="text-caption text-muted-foreground">Sem usuários na base.</p>}
          {top.map(row)}
        </Card>
        <Card variant="premium" className="p-4">
          <p className="text-micro uppercase tracking-wider text-muted-foreground mb-1">Precisam de atenção</p>
          {bottom.length === 0 && <p className="text-caption text-muted-foreground">Nenhum usuário adicional.</p>}
          {bottom.map(row)}
        </Card>
      </div>
    </section>
  );
}

/* ── Churn Prediction ── */
export function CrmChurnPanel({ data }: { data: CrmIntelligence }) {
  const risky = data.churnRisks.filter(c => c.riskPct >= 60).slice(0, 10);
  return (
    <section>
      <SectionTitle hint="Probabilidade derivada do Driver Score e de sinais de abandono.">
        Churn Prediction · {fmtInt(data.atRiskUsers)} em risco
      </SectionTitle>
      <div className="space-y-2">
        {risky.length === 0 && (
          <Card variant="premium" className="p-3 text-caption text-muted-foreground">
            Nenhum usuário com risco alto no momento.
          </Card>
        )}
        {risky.map(c => (
          <Card key={c.userId} variant="premium" className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-display font-semibold truncate">{c.alias}</p>
              <span className={`text-lg font-display font-bold number-tabular ${c.riskPct >= 80 ? 'text-destructive' : 'text-warning'}`}>
                {fmtPct(c.riskPct)}
              </span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {c.reasons.slice(0, 3).map(r => (
                <li key={r} className="text-caption text-muted-foreground">{r}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ── Segmentação ── */
export function CrmSegmentsPanel({ data }: { data: CrmIntelligence }) {
  return (
    <section>
      <SectionTitle hint="Grupos derivados do comportamento real, sem dados pessoais.">Segmentação</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.segments.map(s => (
          <Card key={s.key} variant="premium" className="p-3">
            <p className="text-micro uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-xl font-display font-bold number-tabular mt-0.5">{fmtInt(s.users)}</p>
            <p className="text-micro text-muted-foreground number-tabular">{fmtPct(s.pct)} da base</p>
            <p className="text-micro text-muted-foreground/70 mt-1">{s.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ── Recomendações automáticas ── */
export function CrmRecommendationsPanel({ data }: { data: CrmIntelligence }) {
  return (
    <section>
      <SectionTitle hint="Cada recomendação nasce de uma evidência mensurável da base.">
        Recomendações automáticas
      </SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.recommendations.map(r => (
          <Card key={r.id} variant="highlight" className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-bold">{r.title}</p>
              <Badge variant={r.priority === 'Alta' ? 'destructive' : r.priority === 'Média' ? 'warning' : 'secondary'}>
                {r.priority}
              </Badge>
            </div>
            <p className="text-caption text-muted-foreground mt-1.5">{r.evidence}</p>
            <p className="text-sm mt-2">{r.action}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ── Feature Adoption ── */
function trendTone(t: CrmAdoptionTrend): string {
  if (t.deltaPct > 0.5) return 'text-profit';
  if (t.deltaPct < -0.5) return 'text-destructive';
  return 'text-muted-foreground';
}

export function CrmAdoptionPanel({ data }: { data: CrmIntelligence }) {
  return (
    <section>
      <SectionTitle hint="Percentual da base que usou cada recurso na semana.">Feature Adoption</SectionTitle>
      <Card variant="premium" className="p-4 space-y-3">
        {data.adoption.map(a => (
          <div key={a.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm">{a.label}</span>
              <span className="text-caption number-tabular text-muted-foreground flex items-center gap-1.5">
                {fmtPct(a.prevPct)}
                <ArrowRight size={12} />
                <span className="text-sm font-display font-semibold text-foreground">{fmtPct(a.currPct)}</span>
                <span className={trendTone(a)}>
                  {a.deltaPct >= 0 ? '+' : ''}{a.deltaPct.toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="h-1.5 mt-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary/70 animate-bar-fill" style={{ width: `${Math.max(1, a.currPct)}%` }} />
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}

/* ── Experimentos ── */
export function CrmExperimentsPanel({ data }: { data: CrmIntelligence }) {
  const e = data.experiments;
  return (
    <section>
      <SectionTitle hint="Comparação de versões do app lado a lado.">Experimentos</SectionTitle>
      <Card variant="premium" className="p-4">
        {!e.instrumented || e.arms.length === 0 ? (
          <p className="text-caption text-muted-foreground">{e.note}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-micro uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium py-1">Versão</th>
                <th className="text-right font-medium">Usuários</th>
                <th className="text-right font-medium">Retenção D7</th>
                <th className="text-right font-medium">Turno fechado</th>
                <th className="text-right font-medium">Corridas/usuário</th>
              </tr>
            </thead>
            <tbody>
              {e.arms.map(a => (
                <tr key={a.version} className="divider-hairline">
                  <td className="py-1.5 number-tabular">{a.version}</td>
                  <td className="text-right number-tabular">{fmtInt(a.users)}</td>
                  <td className="text-right number-tabular">{fmtPct(a.retentionD7)}</td>
                  <td className="text-right number-tabular">{fmtPct(a.shiftCompletionPct)}</td>
                  <td className="text-right number-tabular">{a.ridesPerUser.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}

/* ── Customer Journey ── */
export function CrmJourneyPanel({ data }: { data: CrmIntelligence }) {
  return (
    <section>
      <SectionTitle hint="Instalações não são rastreadas; a jornada mensurável começa na conta.">
        Customer Journey
      </SectionTitle>
      <Card variant="premium" className="p-4">
        <div className="space-y-1">
          {data.journey.map((s, i) => (
            <div key={s.key}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm ${s.instrumented ? '' : 'text-muted-foreground'}`}>{s.label}</span>
                    <span className="text-sm font-display font-semibold number-tabular">
                      {s.instrumented ? fmtInt(s.users) : '—'}
                      {s.instrumented && (
                        <span className="text-caption text-muted-foreground ml-1">({fmtPct(s.pctOfTop)})</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 mt-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary animate-bar-fill"
                      style={{ width: `${s.instrumented ? Math.max(2, s.pctOfTop) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              {i < data.journey.length - 1 && (
                <div className="flex items-center gap-2 py-1 pl-1 text-micro text-muted-foreground">
                  <ArrowDown size={12} />
                  {data.journey[i + 1].instrumented && data.journey[i + 1].dropFromPrevPct > 0
                    ? `−${data.journey[i + 1].dropFromPrevPct.toFixed(0)}% nesta transição`
                    : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
