import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getTutorialStatus, saveTutorialStatus, type TutorialStatus } from '@/lib/engagement';
import { isBlockingModalOpen, subscribeBlockingModal } from '@/lib/uiModalState';
import { getTutorialSteps, type TutorialTab } from './steps';
import { positionTutorial, type TutorialRect, type TutorialViewport } from './position';

interface Props {
  userId: string;
  eligible: boolean;
  suspended: boolean;
  activeShift: boolean;
  gps: boolean;
  currentTab: string;
  onNavigate: (tab: TutorialTab) => void;
  onRestore: () => void;
}

export default function InteractiveTutorial({ userId, eligible, suspended, activeShift, gps, currentTab, onNavigate, onRestore }: Props) {
  const [status, setStatus] = useState<TutorialStatus | null>(() => getTutorialStatus(userId));
  const [helpOpen, setHelpOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [storageFailed, setStorageFailed] = useState(false);
  const helpRef = useRef<HTMLButtonElement>(null);
  const [helpHost, setHelpHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHelpHost(document.getElementById('tutorial-help-host')); }, []);
  const blocking = useSyncExternalStore(subscribeBlockingModal, isBlockingModalOpen, () => false);
  const available = eligible && !suspended && !blocking;
  const steps = useMemo(() => getTutorialSteps(activeShift, gps), [activeShift, gps]);
  const step = steps[index];

  const remember = (next: TutorialStatus) => {
    setStorageFailed(!saveTutorialStatus(userId, next));
    setStatus(next);
  };
  const start = () => {
    remember('in_progress');
    setHelpOpen(false);
    setIndex(0);
    setRunning(true);
    onNavigate('home');
  };
  const finish = (next: 'skipped' | 'completed') => {
    remember(next);
    setRunning(false);
    onRestore();
    helpRef.current?.focus({ preventScroll: true });
  };
  const move = (next: number) => {
    const destination = steps[next];
    if (!destination) return;
    setIndex(next);
    onNavigate(destination.tab);
  };

  return <>
    {helpHost && createPortal(
      <Button ref={helpRef} variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-lg" aria-label="Ajuda e tutorial" title="Ajuda e tutorial" disabled={!available} onClick={() => setHelpOpen(true)}>
        <CircleHelp aria-hidden="true" />
      </Button>,
      // The explicit host exists before this component mounts in Index.
      helpHost,
    )}
    {available && !running && !helpOpen && status === null && currentTab === 'home' && <section aria-label="Apresentação do tutorial" className="mb-4 border-l-2 border-primary bg-primary/5 px-4 py-4">
      <div className="flex items-center gap-2 text-primary"><CircleHelp size={18} aria-hidden="true" /><h2 className="font-display text-base font-semibold">Conheça o Visionário Drive</h2></div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Aprenda a acompanhar seus ganhos, organizar seus turnos e entender melhor seus resultados.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button onClick={start}><Play aria-hidden="true" />Começar tutorial</Button><Button variant="ghost" onClick={() => remember('deferred')}>Agora não</Button></div>
    </section>}
    <Dialog open={helpOpen && available && !running} onOpenChange={setHelpOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl pb-[max(1.5rem,env(safe-area-inset-bottom))] [&>button]:min-h-11 [&>button]:min-w-11" onCloseAutoFocus={event => { event.preventDefault(); helpRef.current?.focus({ preventScroll: true }); }}>
        <CircleHelp className="text-primary" size={24} aria-hidden="true" />
        <DialogTitle>Ajuda e tutorial</DialogTitle>
        <DialogDescription>Conheça os caminhos para acompanhar seus resultados, turnos, financeiro e evolução.</DialogDescription>
        <Button onClick={start}><Play aria-hidden="true" />Iniciar tutorial</Button>
        <Button variant="ghost" onClick={() => setHelpOpen(false)}>Fechar</Button>
        {storageFailed && <p role="status" className="text-xs text-warning">Não foi possível lembrar sua escolha neste aparelho. A ajuda continua disponível.</p>}
      </DialogContent>
    </Dialog>
    {running && available && step && <TutorialSpotlight key={index} step={step} number={index + 1} total={steps.length} screenReady={currentTab === step.tab} onNext={() => index === steps.length - 1 ? finish('completed') : move(index + 1)} onBack={index > 0 ? () => move(index - 1) : undefined} onSkip={() => finish('skipped')} />}
  </>;
}

function TutorialSpotlight({ step, number, total, screenReady, onNext, onBack, onSkip }: {
  step: ReturnType<typeof getTutorialSteps>[number]; number: number; total: number; screenReady: boolean;
  onNext: () => void; onBack?: () => void; onSkip: () => void;
}) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<{ left: number; top: number; highlight: TutorialRect | null } | null>(null);
  const [fallback, setFallback] = useState(false);

  useLayoutEffect(() => {
    if (!panel) return;
    let frame = 0;
    let observed: HTMLElement | null = null;
    let scrolled: HTMLElement | null = null;
    const measure = () => {
      const visual = window.visualViewport;
      const viewport: TutorialViewport = { left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0, width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight };
      const candidates = screenReady ? document.querySelectorAll<HTMLElement>(`[data-tutorial="${step.target}"]`) : [];
      const target = candidates.length === 1 && !candidates[0].querySelector('[data-tutorial-loading]') && candidates[0].getClientRects().length > 0 ? candidates[0] : null;
      if (target !== observed) {
        if (observed) resize.unobserve(observed);
        observed = target;
        if (target) resize.observe(target);
      }
      if (target && target !== scrolled) {
        scrolled = target;
        target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center', inline: 'nearest' });
      }
      const rect = target?.getBoundingClientRect();
      const next = positionTutorial(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null, { width: panel.offsetWidth, height: panel.offsetHeight }, viewport);
      setFallback(!next.highlight);
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(panel);
    const mutation = new MutationObserver(schedule);
    const screen = document.querySelector('[data-tutorial-screen]');
    if (screen) mutation.observe(screen, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect(); mutation.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [step.target, screenReady, panel]);

  const highlight = layout?.highlight;
  return <DialogPrimitive.Root open onOpenChange={open => { if (!open) onSkip(); }}>
    <DialogPrimitive.Portal>
      <div className="fixed inset-0 z-[60]" aria-hidden="true">
        {highlight ? <>
          <div className="tutorial-dim absolute inset-x-0 top-0" style={{ height: highlight.top }} />
          <div className="tutorial-dim absolute inset-x-0 bottom-0" style={{ top: highlight.top + highlight.height }} />
          <div className="tutorial-dim absolute left-0" style={{ top: highlight.top, height: highlight.height, width: highlight.left }} />
          <div className="tutorial-dim absolute right-0" style={{ top: highlight.top, height: highlight.height, left: highlight.left + highlight.width }} />
          <div className="absolute rounded-lg border-2 border-primary" data-tutorial-highlight={step.target} style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }} />
        </> : <div className="tutorial-dim absolute inset-0" />}
      </div>
      <DialogPrimitive.Content ref={setPanel} onEscapeKeyDown={event => { event.preventDefault(); onSkip(); }} onPointerDownOutside={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()} className="tutorial-panel fixed z-[61] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-primary/30 bg-popover p-5 text-popover-foreground shadow-premium" style={{ left: layout?.left ?? 16, top: layout?.top ?? 16 }}>
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-primary" aria-live="polite">{number} de {total}</p><Button variant="ghost" size="icon" className="h-11 w-11 -mr-2 -mt-2" aria-label="Pular tutorial" onClick={onSkip}><X aria-hidden="true" /></Button></div>
        <DialogPrimitive.Title className="mt-1 font-display text-lg font-semibold">{step.title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="mt-2 grid text-sm leading-relaxed text-muted-foreground">
          <span className={`col-start-1 row-start-1 ${fallback ? 'invisible' : ''}`} aria-hidden={fallback}>{step.description}</span>
          <span className={`col-start-1 row-start-1 ${fallback ? '' : 'invisible'}`} aria-hidden={!fallback}>{step.alternative}</span>
        </DialogPrimitive.Description>
        <div className="mt-5 flex items-center justify-between gap-2">
          {onBack ? <Button variant="ghost" className="px-3" onClick={onBack}><ArrowLeft aria-hidden="true" />Voltar</Button> : <Button variant="ghost" className="px-3" onClick={onSkip}>Pular</Button>}
          <Button className="px-3" onClick={onNext}>{number === total ? <>Concluir<Check aria-hidden="true" /></> : <>Próximo<ArrowRight aria-hidden="true" /></>}</Button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}