/**
 * SplashScreen — Sprint 7.5.
 * Overlay AMOLED com logo oficial (glow neon + fade+scale).
 * Desmonta imediatamente após hidratação; sem delay artificial.
 * Zero regra de negócio — apenas apresentação.
 */
import { useEffect, useState } from 'react';
import { BRAND_ICON_URL } from '@/assets/branding/logo';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Aguarda 1 frame pós-hidratação e inicia fade-out.
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
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#000] transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ WebkitBackfaceVisibility: 'hidden' }}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-60 bg-primary/40 animate-pulse-glow" />
        <img
          src={BRAND_ICON_URL}
          alt=""
          className="relative w-28 h-28 rounded-3xl animate-splash-in select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
