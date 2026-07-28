/**
 * SessionLayout — Sprint 10.
 * Camada visual full-screen AMOLED usada por Welcome e Summary.
 * Sem lógica, sem estado, sem regra de negócio.
 */
interface Props {
  children: React.ReactNode;
  /** Glow de marca no topo (default) ou neutro. */
  glow?: boolean;
}

export default function SessionLayout({ children, glow = true }: Props) {
  return (
    <div className="fixed inset-0 z-[60] bg-background overflow-y-auto animate-fade-in-up">
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/25 blur-3xl"
        />
      )}
      <div className="relative min-h-full container max-w-lg mx-auto px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col">
        {children}
      </div>
    </div>
  );
}
