import { CircleCheck, Lock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AchievementView } from '@/hooks/useAchievements';
import AchievementIcon from './AchievementIcon';

const rarity = {
  common: { label: 'Comum', className: 'rarity-common' },
  rare: { label: 'Rara', className: 'rarity-rare' },
  epic: { label: 'Épica', className: 'rarity-epic' },
  legendary: { label: 'Lendária', className: 'rarity-legendary' },
};
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

/** Presentation only: progress and rewards come unchanged from useAchievements. */
export default function AchievementCard({ achievement: a }: { achievement: AchievementView }) {
  const appearance = rarity[a.def.rarity];
  return (
    <li className="surface-1 rounded-md border border-border/70 p-4 flex min-w-0 flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${appearance.className}`}>
          <AchievementIcon id={a.def.id} size={22} />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h5 className="font-display text-sm font-semibold leading-snug tracking-normal break-words">{a.def.name}</h5>
          <Badge variant="outline" className={`text-caption font-medium px-2 py-0.5 shadow-none ${appearance.className}`}>{appearance.label}</Badge>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground break-words">{a.def.description}</p>
      <div className="mt-auto space-y-2.5 border-t border-border/60 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-caption">
          <span className={`inline-flex items-center gap-1.5 ${a.unlocked ? 'text-primary' : 'text-muted-foreground'}`}>
            {a.unlocked ? <CircleCheck size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
            {a.unlocked ? 'Desbloqueada' : 'Bloqueada'}
          </span>
          <span className="inline-flex items-center gap-1 font-mono-num font-medium text-foreground"><Sparkles size={12} className="text-primary" aria-hidden="true" />+{a.def.xp} XP</span>
        </div>
        {a.unlocked && a.unlockedAt && <p className="text-caption text-muted-foreground tabular-nums">{new Date(a.unlockedAt).toLocaleDateString('pt-BR')}</p>}
        {!a.unlocked && a.def.progress && (
          <div className="space-y-2">
            <div className="flex justify-between gap-2 text-caption text-muted-foreground"><span>Progresso</span><span className="font-mono-num text-foreground">{percent.format(a.progress)}</span></div>
            <div role="progressbar" aria-label={`Progresso de ${a.def.name}`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={a.progress} aria-valuetext={percent.format(a.progress)} className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `scaleX(${a.progress})` }} />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}