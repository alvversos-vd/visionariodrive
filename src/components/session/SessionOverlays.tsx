/**
 * SessionOverlays — Sprint 10.
 * Monta as telas full-screen da Sessão Visionária conforme a fase visual.
 */
import { useDashboard } from '@/hooks/useDashboard';
import { useDayMetrics } from '@/hooks/useMetrics';
import { useSessionMode } from './SessionModeContext';
import SessionWelcome from './SessionWelcome';
import SessionSummary from './SessionSummary';

const YESTERDAY = new Date(Date.now() - 86_400_000);

export default function SessionOverlays({ refresh }: { refresh: number }) {
  const { phase, summary, startSession, cancelWelcome, closeSummary } = useSessionMode();
  const { goals } = useDashboard(refresh);
  const yesterday = useDayMetrics(YESTERDAY);

  if (phase === 'welcome') {
    return <SessionWelcome metaDaily={goals.daily} onStart={startSession} onCancel={cancelWelcome} />;
  }
  if (phase === 'summary' && summary) {
    return <SessionSummary data={summary} lucroOntem={yesterday.netProfit} onClose={closeSummary} />;
  }
  return null;
}
