/** Presentation only: preserve the existing Date(iso) local interpretation. */
export function historyDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function historyDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (historyDayKey(iso) === historyDayKey(now.toISOString())) return 'Hoje';
  if (historyDayKey(iso) === historyDayKey(yesterday.toISOString())) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}