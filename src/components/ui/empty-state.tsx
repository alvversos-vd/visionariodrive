/**
 * EmptyState — Sprint 7.5.
 * Componente reutilizável para telas vazias.
 * Ilustração via SVG minimalista neon.
 */
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12 animate-fade-in-up', className)}>
      {icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full" />
          <div className="relative w-16 h-16 rounded-2xl border border-primary/30 bg-card flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
      )}
      <h3 className="font-display font-bold text-base text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 text-[13px] text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
