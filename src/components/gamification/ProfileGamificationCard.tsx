/**
 * ProfileGamificationCard — Sprint 6 · Fase 2 + Sprint 6.3 (expansão).
 * Perfil Inteligente: nível, XP, stats detalhados, conquistas e evolução.
 * Consome APENAS Services (via hooks).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Lock, ChevronDown, ChevronUp, LineChart as LineChartIcon } from 'lucide-react';
import XpProgressBar from './XpProgressBar';
import AchievementsModal from './AchievementsModal';
import MyEvolutionChart from './MyEvolutionChart';
import { useXp } from '@/hooks/useXp';
import { useAchievements } from '@/hooks/useAchievements';
import { achievementService } from '@/lib/services/achievementService';
import { telemetry } from '@/lib/telemetry';
import type { Rarity } from '@/lib/gamification/catalog';

const RARITY_STYLE: Record<Rarity, string> = {
  common: 'bg-secondary text-foreground border-border',
  rare: 'bg-primary/10 text-primary border-primary/30',
  epic: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  legendary: 'bg-amber-500/10 text-amber-500 border-amber-500/40',
};

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center justify-between">
          <span>Perfil Inteligente</span>
          <Badge variant="outline" className="gap-1 cursor-pointer" onClick={openModal}>
            <Trophy size={12} /> {unlockedList.length}/{all.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <XpProgressBar />
          <div className="flex items-baseline justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{fmtInt(totalXp)} XP totais</span>
            {ctx.xpEarnedToday > 0 && <span>+{fmtInt(ctx.xpEarnedToday)} XP hoje</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Corridas" value={fmtInt(ctx.ridesTotal)} />
          <Stat label="Km rodados" value={`${fmtInt(ctx.totalKm)} km`} />
          <Stat label="Faturado" value={fmtBRL(ctx.totalEarned)} />
          <Stat label="Melhor dia" value={fmtBRL(ctx.bestDailyEarned)} />
          <Stat label="Turnos" value={fmtInt(ctx.shiftsTotal)} />
          <Stat label="Maior turno" value={fmtDuration(ctx.longestShiftMinutes)} />
          <Stat label="Dias seguidos" value={fmtInt(ctx.consecutiveDays)} />
          <Stat label="Metas batidas" value={fmtInt(ctx.goalHitCount)} />
          <Stat label="Dias no app" value={fmtInt(ctx.daysUsingApp)} />
          <Stat label="Seções abertas" value={`${fmtInt(ctx.tabsVisited)}/5`} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-display font-bold text-muted-foreground">
            <LineChartIcon size={12} /> Minha evolução (XP por semana)
          </div>
          <MyEvolutionChart />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-display font-bold text-muted-foreground">
              Conquistas desbloqueadas
            </h4>
            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={openModal}>
              Ver todas
            </Button>
          </div>
          {unlockedList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma ainda — comece um turno para desbloquear.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5">
              {unlockedList.slice(0, 5).map(a => (
                <li key={a.def.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${RARITY_STYLE[a.def.rarity]}`}>
                  <span className="text-lg leading-none">{a.def.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-display font-bold truncate">{a.def.name}</p>
                    <p className="text-[10px] opacity-80 truncate">{a.def.description}</p>
                  </div>
                  <span className="text-[10px] font-bold tabular-nums">+{a.def.xp} XP</span>
                </li>
              ))}
              {unlockedList.length > 5 && (
                <li>
                  <Button variant="ghost" size="sm" className="w-full text-[11px] h-7" onClick={openModal}>
                    +{unlockedList.length - 5} conquistas
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowLocked(v => !v)}
            className="w-full flex items-center justify-between text-xs font-display font-bold text-muted-foreground py-1.5"
          >
            <span className="flex items-center gap-1.5"><Lock size={12} /> Próximas conquistas ({lockedList.length})</span>
            {showLocked ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showLocked && (
            <ul className="grid grid-cols-1 gap-1.5 mt-1">
              {lockedList.slice(0, 6).map(a => {
                const pct = Math.round((a.progress ?? 0) * 100);
                return (
                  <li key={a.def.id} className="rounded-md border border-border/60 bg-secondary/30 px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none opacity-50">{a.def.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-display font-bold truncate">{a.def.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.def.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">+{a.def.xp} XP</span>
                    </div>
                    {a.def.progress && (
                      <div className="mt-1 h-1 w-full bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-primary/50" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
              {lockedList.length > 6 && (
                <li>
                  <Button variant="ghost" size="sm" className="w-full text-[11px] h-7" onClick={openModal}>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-display font-bold tabular-nums">{value}</p>
    </div>
  );
}
