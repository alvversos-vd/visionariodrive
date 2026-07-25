/**
 * LevelUpModal — Sprint 6.3.
 *
 * Modal celebratório disparado em 'level-up'. Mostra o novo nível, XP total
 * e as conquistas desbloqueadas nesta sessão.
 *
 * Zero regra de negócio. Consome apenas services via hooks.
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Trophy } from 'lucide-react';
import { useBusVersion } from '@/hooks/useBusVersion';
import { xpService } from '@/lib/services/xpService';
import { achievementService } from '@/lib/services/achievementService';
import { telemetry } from '@/lib/telemetry';

export default function LevelUpModal() {
  const vLevel = useBusVersion('level-up');
  const [open, setOpen] = useState(false);
  const [newLevel, setNewLevel] = useState<number | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [recent, setRecent] = useState<Array<{ id: string; name: string; icon: string; xp: number }>>([]);
  const [bootstrap, setBootstrap] = useState(true);

  useEffect(() => {
    if (bootstrap) { setBootstrap(false); return; }
    const p = xpService.progress();
    setNewLevel(p.level);
    setTotalXp(p.totalXp);
    // pega até 3 conquistas mais recentes desbloqueadas
    const recentUnlocked = achievementService.unlocked().slice(-3).reverse();
    setRecent(recentUnlocked
      .map(u => {
        const def = achievementService.get(u.id);
        return def ? { id: def.id, name: def.name, icon: def.icon, xp: def.xp } : null;
      })
      .filter((v): v is { id: string; name: string; icon: string; xp: number } => v !== null));
    setOpen(true);
    telemetry.recordGamification('levelup_modal', 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vLevel]);

  if (newLevel === null) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-brand flex items-center justify-center mb-2 shadow-lg animate-in zoom-in duration-500">
            <Sparkles className="text-primary-foreground" size={36} />
          </div>
          <DialogTitle className="font-display text-center text-2xl">
            Nível {newLevel} alcançado!
          </DialogTitle>
          <DialogDescription className="text-center">
            Você agora acumula <strong className="tabular-nums">{totalXp.toLocaleString('pt-BR')}</strong> XP.
            <br />Continue nesse ritmo — próximas conquistas estão perto.
          </DialogDescription>
        </DialogHeader>

        {recent.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground font-display font-bold flex items-center gap-1">
              <Trophy size={12} /> Conquistas recentes
            </p>
            <ul className="space-y-1">
              {recent.map(r => (
                <li key={r.id} className="flex items-center gap-2 rounded-md bg-secondary/60 px-2 py-1.5">
                  <span className="text-lg">{r.icon}</span>
                  <span className="text-xs font-display font-bold flex-1 truncate">{r.name}</span>
                  <span className="text-micro tabular-nums font-bold">+{r.xp} XP</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={() => setOpen(false)} className="w-full mt-2">
          Continuar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
