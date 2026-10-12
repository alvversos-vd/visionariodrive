import { Trophy, Lock, ChevronDown, ChevronUp, GraduationCap, LineChart as LineChartIcon } from 'lucide-react';
import AchievementCard from './AchievementCard';
/**
 * ProfileGamificationCard — Sprint 6 · Fase 2 + Sprint 6.3 + Sprint 7.5 Onda 4.
 * Perfil Inteligente premium: XP hero, stats primárias (grid 2×3),
 * secundárias compactas, conquistas com glow disciplinado por raridade.
 * Consome APENAS Services (via hooks).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import XpProgressBar from './XpProgressBar';
import AchievementsModal from './AchievementsModal';
import MyEvolutionChart from './MyEvolutionChart';
import { useXp } from '@/hooks/useXp';
import { useAchievements } from '@/hooks/useAchievements';
import { achievementService } from '@/lib/services/achievementService';
import { telemetry } from '@/lib/telemetry';
import { useAuth } from '@/contexts/AuthContext';
import { getTutorialStatus } from '@/lib/engagement';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtInt(n: number) { return new Intl.NumberFormat('pt-BR').format(Math.round(n)); }
function fmtDuration(min: number): string {
  if (min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`;
}

export default function ProfileGamificationCard({
  accountCreatedAt,
}: { accountCreatedAt: string | null }) {
  const { progress, totalXp } = useXp();
  const { all, unlocked } = useAchievements(accountCreatedAt);
  const [showLocked, setShowLocked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { user } = useAuth();
  const tutorialCompleted = user ? getTutorialStatus(user.id) === 'completed' : false;

  const ctx = useMemo(() => achievementService.snapshotContext(accountCreatedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountCreatedAt, unlocked.length, progress.totalXp]);

  const unlockedList = all.filter(a => a.unlocked);
  const lockedList = all.filter(a => !a.unlocked);

  const openModal = () => {
    telemetry.recordGamification('achievement_details', 1);
    setModalOpen(true);
  };

  return (
    <>
    <Card variant="premium">
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center justify-between">
          <span>Perfil Inteligente</span>
          <Button data-tutorial="achievements" variant="ghost" className="gap-1 min-h-11 px-3 text-xs text-primary" aria-label="Abrir todas as conquistas" onClick={openModal}>
            <Trophy size={12} /> {unlockedList.length}/{all.length}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <XpProgressBar />
          <div className="flex items-baseline justify-between text-caption text-muted-foreground tabular-nums">
            <span>{fmtInt(totalXp)} XP totais</span>
            {ctx.xpEarnedToday > 0 && <span className="text-neon">+{fmtInt(ctx.xpEarnedToday)} XP hoje</span>}
          </div>
        </div>

        {/* Stats primárias: grid 2×3 */}
        <div className="grid grid-cols-2 gap-2">
          <PrimaryStat label="Corridas" value={fmtInt(ctx.ridesTotal)} />
          <PrimaryStat label="Km rodados" value={`${fmtInt(ctx.totalKm)} km`} />
          <PrimaryStat label="Faturado" value={fmtBRL(ctx.totalEarned)} highlight />
          <PrimaryStat label="Melhor dia" value={fmtBRL(ctx.bestDailyEarned)} />
          <PrimaryStat label="Turnos" value={fmtInt(ctx.shiftsTotal)} />
          <PrimaryStat label="Dias seguidos" value={fmtInt(ctx.consecutiveDays)} />
        </div>

        {/* Stats secundárias: linha compacta */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 divider-hairline">
          <MiniStat label="Maior turno" value={fmtDuration(ctx.longestShiftMinutes)} />
          <MiniStat label="Metas batidas" value={fmtInt(ctx.goalHitCount)} />
          <MiniStat label="Dias no app" value={fmtInt(ctx.daysUsingApp)} />
          <MiniStat label="Seções abertas" value={`${fmtInt(ctx.tabsVisited)}/5`} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-caption font-display font-bold text-muted-foreground">
            <LineChartIcon size={12} /> Minha evolução (XP por semana)
          </div>
          <MyEvolutionChart />
        </div>

        {tutorialCompleted && <section aria-label="Badge do tutorial" className="flex items-start gap-3 border-l-2 border-primary bg-primary/5 px-3 py-3">
          <GraduationCap size={24} className="shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h4 className="font-display text-sm font-semibold">Primeiros Passos</h4><Badge variant="outline" className="border-primary/30 text-primary">Concluído</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">Tutorial concluído · Neste aparelho</p>
          </div>
        </section>}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-caption font-display font-bold text-muted-foreground">
              Conquistas desbloqueadas
            </h4>
            <Button size="sm" variant="ghost" className="min-h-11 text-xs px-3" onClick={openModal}>
              Ver todas
            </Button>
          </div>
          {unlockedList.length === 0 ? (
            <p className="text-caption text-muted-foreground italic">Nenhuma ainda — comece um turno para desbloquear.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3">
              {unlockedList.slice(0, 5).map(a => (
                <AchievementCard key={a.def.id} achievement={a} />
              ))}
              {unlockedList.length > 5 && (
                <li>
                  <Button variant="ghost" size="sm" className="w-full text-xs min-h-11" onClick={openModal}>
                    +{unlockedList.length - 5} conquistas
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setShowLocked(v => !v)}
            aria-expanded={showLocked}
            className="w-full min-h-11 h-auto flex items-center justify-between gap-2 whitespace-normal text-xs font-display font-semibold text-muted-foreground px-0 py-2"
          >
            <span className="flex items-center gap-1.5"><Lock size={12} /> Próximas conquistas ({lockedList.length})</span>
            {showLocked ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          {showLocked && (
            <ul className="grid grid-cols-1 gap-3 mt-2">
              {lockedList.slice(0, 6).map(a => <AchievementCard key={a.def.id} achievement={a} />)}
              {lockedList.length > 6 && (
                <li>
                  <Button variant="ghost" size="sm" className="w-full text-xs min-h-11" onClick={openModal}>
                    Ver todas ({lockedList.length})
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
    <AchievementsModal open={modalOpen} onOpenChange={setModalOpen} accountCreatedAt={accountCreatedAt} />
    </>
  );
}

function PrimaryStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md px-2.5 py-2 ${highlight ? 'card-highlight' : 'bg-secondary/60 border border-border/60'}`}>
      <p className="text-micro text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-display font-bold tabular-nums mt-0.5 ${highlight ? 'text-neon' : ''}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-micro text-muted-foreground">{label}</span>
      <span className="text-caption font-display font-semibold tabular-nums">{value}</span>
    </div>
  );
}
