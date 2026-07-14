/**
 * AdminCRM — Sprint 6 · Fase 1.
 *
 * Página administrativa. Só renderiza para usuários com role 'admin'.
 * Consome exclusivamente useCrm (Service). Sem acesso direto a Repository/Supabase.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Users, Activity, Car, TrendingUp, Clock, MapPin, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import { useCrm } from '@/hooks/useCrm';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function fmtInt(n: number): string { return new Intl.NumberFormat('pt-BR').format(Math.round(n)); }
function fmtBRL(n: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n); }

export default function AdminCRM() {
  const { user, loading: authLoading } = useAuth();
  const { loading: roleLoading, isAdmin } = useIsAdmin();
  const { loading, error, snapshot, refresh } = useCrm();
  const navigate = useNavigate();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Voltar">
            <ArrowLeft size={18} />
          </Button>
          <h1 className="font-display font-bold text-lg flex-1">CRM · Visionário Drive</h1>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="ml-2">Atualizar</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <Card className="p-4 border-destructive/40 text-destructive text-sm">{error}</Card>
        )}
        {loading && !snapshot && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="animate-spin" size={16} /> Carregando métricas…
          </div>
        )}

        {snapshot && (
          <>
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Usuários</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Cadastrados" value={fmtInt(snapshot.kpis.totalUsers)} icon={Users} />
                <Kpi label="Ativos hoje" value={fmtInt(snapshot.kpis.activeToday)} icon={Activity} />
                <Kpi label="Ativos 7d" value={fmtInt(snapshot.kpis.active7d)} icon={Activity} />
                <Kpi label="Ativos 30d" value={fmtInt(snapshot.kpis.active30d)} icon={Activity} />
                <Kpi label="Novos hoje" value={fmtInt(snapshot.kpis.newToday)} icon={Users} />
                <Kpi label="Novos 7d" value={fmtInt(snapshot.kpis.new7d)} icon={Users} />
                <Kpi label="PRO" value={fmtInt(snapshot.kpis.proUsers)} icon={TrendingUp} />
                <Kpi label="Onboarding %" value={`${snapshot.kpis.onboardedPct.toFixed(0)}%`} icon={Activity} />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Turnos & Corridas</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Turnos iniciados hoje" value={fmtInt(snapshot.kpis.shiftsStartedToday)} icon={Clock} />
                <Kpi label="Turnos encerrados hoje" value={fmtInt(snapshot.kpis.shiftsEndedToday)} icon={Clock} />
                <Kpi label="Corridas totais" value={fmtInt(snapshot.kpis.ridesTotal)} icon={Car} />
                <Kpi label="GPS auto" value={`${snapshot.kpis.autoSharePct.toFixed(0)}%`} icon={MapPin} />
                <Kpi label="Corridas auto" value={fmtInt(snapshot.kpis.ridesAuto)} icon={MapPin} />
                <Kpi label="Corridas manuais" value={fmtInt(snapshot.kpis.ridesManual)} icon={Car} />
                <Kpi label="Km percorridos" value={`${fmtInt(snapshot.kpis.totalKm)} km`} icon={MapPin} />
                <Kpi label="Lucro registrado" value={fmtBRL(snapshot.kpis.totalProfit)} icon={TrendingUp} />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Usuários por dia (30d)</h2>
              <Card className="p-4">
                <div className="h-64">
                  <ResponsiveContainer>
                    <LineChart data={snapshot.series30d}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="activeUsers" stroke="hsl(var(--primary))" name="Ativos" dot={false} />
                      <Line type="monotone" dataKey="signups" stroke="hsl(var(--muted-foreground))" name="Novos" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Corridas por hora do dia</h2>
              <Card className="p-4">
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={snapshot.hourly24h}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="rides" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            <p className="text-xs text-muted-foreground text-right">
              Snapshot: {new Date(snapshot.generatedAt).toLocaleString('pt-BR')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
