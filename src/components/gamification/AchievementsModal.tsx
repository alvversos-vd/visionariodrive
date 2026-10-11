import { Trophy, Lock, CircleCheck } from 'lucide-react';
import AchievementCard from './AchievementCard';
/**
 * AchievementsModal — Sprint 6.3.
 * Modal "Todas as Conquistas". Consome apenas hooks/serviços.
 */
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { useAchievements } from '@/hooks/useAchievements';
import { telemetry } from '@/lib/telemetry';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountCreatedAt: string | null;
}

export default function AchievementsModal({ open, onOpenChange, accountCreatedAt }: Props) {
  const { all } = useAchievements(accountCreatedAt);

  useEffect(() => {
    if (open) telemetry.recordGamification('achievement_view', 1);
  }, [open]);

  const unlocked = all.filter(a => a.unlocked);
  const locked = all.filter(a => !a.unlocked);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[calc(100%-2rem)] max-w-3xl max-h-[min(90dvh,56rem)] flex-col gap-0 overflow-hidden rounded-lg p-0 motion-reduce:animate-none [&>button]:right-2 [&>button]:top-2 [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center">
        <DialogHeader className="shrink-0 border-b border-border/60 p-5 pr-14 text-left">
          <DialogTitle className="font-display flex items-center gap-2.5 text-lg tracking-normal leading-snug">
            <Trophy size={22} className="shrink-0 text-primary" aria-hidden="true" /> Todas as Conquistas
          </DialogTitle>
          <DialogDescription className="pl-8 text-xs tabular-nums">
            {unlocked.length} de {all.length} desbloqueadas
          </DialogDescription>
        </DialogHeader>

        <section className="min-h-0 overflow-y-auto overscroll-contain space-y-6 p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div>
            <h4 className="text-sm font-display font-semibold mb-3 flex items-center gap-2 tracking-normal"><CircleCheck size={16} className="text-primary" aria-hidden="true" />Desbloqueadas <span className="text-caption text-muted-foreground tabular-nums">{unlocked.length}</span></h4>
            {unlocked.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma ainda.</p>
            ) : (
              <ul className="grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
                {unlocked.map(a => (
                  <AchievementCard key={a.def.id} achievement={a} />
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-sm font-display font-semibold mb-3 flex items-center gap-2 tracking-normal">
              <Lock size={16} className="text-muted-foreground" aria-hidden="true" /> Bloqueadas <span className="text-caption text-muted-foreground tabular-nums">{locked.length}</span>
            </h4>
            <ul className="grid grid-cols-1 min-[600px]:grid-cols-2 gap-3">
              {locked.map(a => <AchievementCard key={a.def.id} achievement={a} />)}
            </ul>
          </div>
        </section>

      </DialogContent>
    </Dialog>
  );
}
