/**
 * XpProgressBar — Sprint 6 · Fase 2.
 * Barra elegante de nível/XP. Consome useXp. Não lê Repository.
 */
import { useXp } from '@/hooks/useXp';

export default function XpProgressBar({ compact = false }: { compact?: boolean }) {
  const { progress } = useXp();
  const pctInt = Math.round(progress.pct * 100);
  return (
    <div className="w-full">
      <div className={`flex items-baseline justify-between ${compact ? 'text-[11px]' : 'text-xs'} mb-1`}>
        <span className="font-display font-bold tracking-wide">Nível {progress.level}</span>
        <span className="text-muted-foreground tabular-nums">
          {progress.currentLevelXp} / {progress.nextLevelXp} XP
        </span>
      </div>
      <div
        className={`w-full ${compact ? 'h-2' : 'h-2.5'} bg-secondary rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={pctInt}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso do nível ${progress.level}`}
      >
        <div
          className="h-full bg-gradient-brand transition-[width] duration-700 ease-out"
          style={{ width: `${pctInt}%` }}
        />
      </div>
      {!compact && progress.remainingXp > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1 text-right">
          faltam {progress.remainingXp} XP para o nível {progress.level + 1}
        </p>
      )}
    </div>
  );
}
