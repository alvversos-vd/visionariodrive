/**
 * SplashScreen — Sprint 10.5.
 * Abertura premium AMOLED: símbolo → nome → tagline → loading minimalista.
 * Desmonta imediatamente após hidratação; zero regra de negócio.
 */
import { useEffect, useState } from 'react';
import BrandLockup from '@/components/brand/BrandLockup';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const t = window.setTimeout(() => setFading(true), 350);
      return () => window.clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => setVisible(false), 600);
    return () => window.clearTimeout(t);
  }, [fading]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-10 bg-background transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ WebkitBackfaceVisibility: 'hidden' }}
    >
      <BrandLockup size="lg" className="animate-splash-in" />
      <div className="h-px w-24 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/2 animate-pulse-dot rounded-full bg-primary/70" />
      </div>
    </div>
  );
}
