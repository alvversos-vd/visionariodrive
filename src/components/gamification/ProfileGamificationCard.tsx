/**
 * ProfileGamificationCard — Sprint 6 · Fase 2.
 * Seção do Perfil Inteligente: nível, XP, conquistas e estatísticas.
 * Consome APENAS Services (via hooks).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import XpProgressBar from './XpProgressBar';
import { useXp } from '@/hooks/useXp';
import { useAchievements } from '@/hooks/useAchievements';
import { achievementService } from '@/lib/services/achievementService';
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

export default function ProfileGamificationCard({
  accountCreatedAt,
}: { accountCreatedAt: string | null }) {
  const { progress, totalXp } = useXp();
  const { all, unlocked } = useAchievements(accountCreatedAt);
  const [showLocked, setShowLocked] = useState(false);

  const ctx = useMemo(() => achievementService.snapshotContext(accountCreatedAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountCreatedAt, unlocked.length, progress.totalXp]);

  const unlockedList = all.filter(a => a.unlocked);
  const lockedList = all.filter(a => !a.unlocked);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center justify-between">
          <span>Perfil Inteligente</span>
          <Badge variant="outline" className="gap-1"><Trophy size={12} /> {unlockedList.length}/{all.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <XpProgressBar />
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {fmtInt(totalXp)} XP totais
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Corridas" value={fmtInt(ctx.ridesTotal)} />
          <Stat label="Km rodados" value={`${fmtInt(ctx.totalKm)} km`} />
          <Stat label="Faturado" value={fmtBRL(ctx.totalEarned)} />
          <Stat label="Turnos" value={fmtInt(ctx.shiftsTotal)} />
          <Stat label="Dias seguidos" value={fmtInt(ctx.consecutiveDays)} />
          <Stat label="Metas batidas" value={fmtInt(ctx.goalHitCount)} />
        </div>

        <div>
          <h4 className="text-xs font-display font-bold text-muted-foreground mb-2">
            Conquistas desbloqueadas
          </h4>
          {unlockedList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma ainda — comece um turno para desbloquear.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5">
              {unlockedList.map(a => (
                <li key={a.def.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${RARITY_STYLE[a.def.rarity]}`}>
                  <span className="text-lg leading-none">{a.def.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-display font-bold truncate">{a.def.name}</p>
                    <p className="text-[10px] opacity-80 truncate">{a.def.description}</p>
                  </div>
                  <span className="text-[10px] font-bold tabular-nums">+{a.def.xp} XP</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowLocked(v => !v)}
            className="w-full flex items-center justify-between text-xs font-display font-bold text-muted-foreground py-1.5"
          >
            <span className="flex items-center gap-1.5"><Lock size={12} /> Conquistas bloqueadas ({lockedList.length})</span>
            {showLocked ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showLocked && (
            <ul className="grid grid-cols-1 gap-1.5 mt-1">
              {lockedList.map(a => {
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
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
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
