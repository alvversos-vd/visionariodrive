import { useState } from 'react';
import { Menu, X, Check, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface NavigationItem<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
  indicator?: React.ReactNode;
}

interface TabNavigationProps<T extends string> {
  items: NavigationItem<T>[];
  current: NavigationItem<T>;
  onSelect: (key: T) => void;
  dimSecondary?: boolean;
}

export default function TabNavigation<T extends string>({ items, current, onSelect, dimSecondary = false }: TabNavigationProps<T>) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const entries = items.map(item => {
    const active = current.key === item.key;
    const dimmed = dimSecondary && item.key !== 'home';
    return (
      <Button
        key={item.key}
        type="button"
        variant="ghost"
        aria-current={active ? 'page' : undefined}
        onClick={() => { onSelect(item.key); setOpen(false); }}
        className={cn(
          'motion-reduce:transition-none font-display',
          mobile
             ? 'h-auto min-h-11 w-full justify-start gap-3 px-3 py-2 text-sm'
            : 'h-auto min-h-12 min-w-0 flex-1 flex-col gap-1 px-1 py-2.5 text-caption',
          active ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-bold' : 'text-muted-foreground font-semibold',
          dimmed && !active && 'opacity-40',
        )}
      >
        <item.icon aria-hidden="true" />
        <span className={mobile ? 'flex-1 text-left whitespace-normal' : 'whitespace-normal'}>{item.label}</span>
        {mobile ? (
          <span className="flex min-w-11 shrink-0 items-center justify-end gap-2 text-micro text-muted-foreground">
            {item.indicator}
            {active && <Check className="text-primary" aria-hidden="true" />}
          </span>
        ) : item.indicator}
      </Button>
    );
  });

  if (!mobile) {
    return <nav aria-label="Seções" className="flex gap-0.5 rounded-xl border border-border/60 bg-card/60 p-1">{entries}</nav>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={open ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
          className="h-12 w-full justify-start gap-3 rounded-xl border border-border/60 bg-card px-4 text-foreground hover:bg-secondary motion-reduce:transition-none"
        >
          <current.icon className="text-primary" aria-hidden="true" />
          <span className="flex-1 text-left font-display font-semibold">{current.label}</span>
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        collisionPadding={16}
        sideOffset={8}
        aria-label="Navegação"
        className="w-[var(--radix-popover-trigger-width)] max-h-[min(var(--radix-popover-content-available-height),26rem)] overflow-y-auto overscroll-contain rounded-xl border-border/70 bg-popover p-1 shadow-elevated duration-150 motion-reduce:animate-none"
      >
        <nav aria-label="Seções">{entries}</nav>
      </PopoverContent>
    </Popover>
  );
}