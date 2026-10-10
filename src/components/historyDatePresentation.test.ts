import { describe, expect, it } from 'vitest';
import { historyDayKey, historyDayLabel } from './historyDatePresentation';

describe('History presentation uses existing local dates', () => {
  const now = new Date(2026, 9, 10, 12);
  it('identifies today from the real local record date', () => {
    expect(historyDayLabel(new Date(2026, 9, 10, 0, 5).toISOString(), now)).toBe('Hoje');
  });
  it('identifies yesterday across a month boundary', () => {
    expect(historyDayLabel(new Date(2026, 8, 30, 23, 55).toISOString(), new Date(2026, 9, 1, 12))).toBe('Ontem');
  });
  it('formats older dates with year without changing their interpretation', () => {
    expect(historyDayLabel(new Date(2025, 9, 8, 12).toISOString(), now)).toBe('08/10/2025');
  });
  it('keeps records on different local days separate at midnight', () => {
    expect(historyDayKey(new Date(2026, 9, 9, 23, 59).toISOString())).not.toBe(historyDayKey(new Date(2026, 9, 10, 0, 1).toISOString()));
  });
});