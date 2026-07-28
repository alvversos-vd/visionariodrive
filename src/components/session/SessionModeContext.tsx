/**
 * SessionModeContext — Sprint 10.
 *
 * ESTADO PURAMENTE VISUAL. Não controla turno, GPS, banco, Services,
 * Repositories nem EventBus. Apenas informa aos componentes em qual
 * "modo de apresentação" o app está.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type SessionPhase = 'off' | 'welcome' | 'active' | 'summary';

/** Snapshot visual do turno, capturado no encerramento (sem cálculo novo). */
export interface SessionSummaryData {
  minutos: number;
  corridas: number;
  km: number;
  lucro: number;
  metaDaily: number;
  metaPct: number;
}

interface SessionModeValue {
  phase: SessionPhase;
  sessionMode: boolean;
  summary: SessionSummaryData | null;
  openWelcome: () => void;
  cancelWelcome: () => void;
  startSession: () => void;
  finishSession: (data: SessionSummaryData) => void;
  closeSummary: () => void;
}

const SessionModeCtx = createContext<SessionModeValue | null>(null);

export function SessionModeProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<SessionPhase>('off');
  const [summary, setSummary] = useState<SessionSummaryData | null>(null);

  const openWelcome = useCallback(() => setPhase('welcome'), []);
  const cancelWelcome = useCallback(() => setPhase('off'), []);
  const startSession = useCallback(() => setPhase('active'), []);
  const finishSession = useCallback((data: SessionSummaryData) => {
    setSummary(data);
    setPhase('summary');
  }, []);
  const closeSummary = useCallback(() => {
    setSummary(null);
    setPhase('off');
  }, []);

  const value = useMemo<SessionModeValue>(() => ({
    phase,
    sessionMode: phase === 'active',
    summary,
    openWelcome,
    cancelWelcome,
    startSession,
    finishSession,
    closeSummary,
  }), [phase, summary, openWelcome, cancelWelcome, startSession, finishSession, closeSummary]);

  return <SessionModeCtx.Provider value={value}>{children}</SessionModeCtx.Provider>;
}

export function useSessionMode(): SessionModeValue {
  const ctx = useContext(SessionModeCtx);
  if (!ctx) {
    // Fora do provider o app continua em modo normal — nunca quebra.
    return {
      phase: 'off',
      sessionMode: false,
      summary: null,
      openWelcome: () => {},
      cancelWelcome: () => {},
      startSession: () => {},
      finishSession: () => {},
      closeSummary: () => {},
    };
  }
  return ctx;
}
