/**
 * useCountUp — animação numérica via requestAnimationFrame.
 * Sem setInterval, sem polling. Respeita prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || duration <= 0) { setValue(target); return; }
    fromRef.current = value;
    startRef.current = null;
    const from = fromRef.current;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
