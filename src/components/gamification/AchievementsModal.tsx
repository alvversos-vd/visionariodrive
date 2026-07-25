/**
 * AchievementsModal — Sprint 6.3.
 * Modal "Todas as Conquistas". Consome apenas hooks/serviços.
 */
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trophy, Lock } from 'lucide-react';
import { useAchievements } from '@/hooks/useAchievements';
import { telemetry } from '@/lib/telemetry';
import type { Rarity } from '@/lib/gamification/catalog';

const RARITY_CLASS: Record<Rarity, string> = {
  common: 'rarity-common',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  legendary: 'rarity-legendary',
};


const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Comum', rare: 'Rara', epic: 'Épica', legendary: 'Lendária',
};

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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Trophy size={18} /> Todas as Conquistas
          </DialogTitle>
          <DialogDescription>
            {unlocked.length} de {all.length} desbloqueadas
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <div>
            <h4 className="text-caption font-display font-bold text-muted-foreground mb-2">Desbloqueadas</h4>
            {unlocked.length === 0 ? (
              <p className="text-caption text-muted-foreground italic">Nenhuma ainda.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5">
                {unlocked.map(a => (
                  <li key={a.def.id} className={`flex items-start gap-2 rounded-md px-2 py-2 ${RARITY_CLASS[a.def.rarity]}`}>
                    <span className="text-xl leading-none mt-0.5">{a.def.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-display font-bold truncate">{a.def.name}</p>
                        <Badge variant="outline" className="text-micro px-1 py-0 h-4">{RARITY_LABEL[a.def.rarity]}</Badge>
                      </div>
                      <p className="text-micro opacity-80">{a.def.description}</p>
                      {a.unlockedAt && (
                        <p className="text-micro opacity-70 mt-0.5">
                          {new Date(a.unlockedAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <span className="text-micro font-bold tabular-nums whitespace-nowrap">+{a.def.xp} XP</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-caption font-display font-bold text-muted-foreground mb-2 flex items-center gap-1">
              <Lock size={12} /> Bloqueadas ({locked.length})
            </h4>
            <ul className="grid grid-cols-1 gap-1.5">
              {locked.map(a => {
                const pct = Math.round((a.progress ?? 0) * 100);
                return (
                  <li key={a.def.id} className="rarity-locked rounded-md px-2 py-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xl leading-none opacity-50 mt-0.5">{a.def.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-display font-bold truncate">{a.def.name}</p>
                          <Badge variant="outline" className="text-micro px-1 py-0 h-4">{RARITY_LABEL[a.def.rarity]}</Badge>
                        </div>
                        <p className="text-micro text-muted-foreground">{a.def.description}</p>
                      </div>
                      <span className="text-micro text-muted-foreground tabular-nums whitespace-nowrap">+{a.def.xp} XP</span>
                    </div>
                    {a.def.progress && (
                      <>
                        <div className="mt-1.5 h-1 w-full bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-primary/50 transition-[width]" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-micro text-muted-foreground text-right mt-0.5 tabular-nums">{pct}%</p>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

      </DialogContent>
    </Dialog>
  );
}
