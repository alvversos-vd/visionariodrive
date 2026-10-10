# Gate 3 — Histórico Premium UX

## Scope and source audit

Presentation only in HistoryView and ShiftHistoryView. Existing adjusted daily entries, expense-only days, bonus financial entries, analyzed individual rides and finalized shifts remain available in their existing sections. No services, repositories, tracking, permissions, native forms, persistence or access rules were changed.

HistoryView continues reading metricsService, financialService and rideService. ShiftHistoryView continues reading shiftService totals and existing ride grouping. Existing vehicle, ride-type, period and app filters remain; existing deletion, shift expansion and PRO export/route actions remain. No new record category or unified persistence was introduced.

## Presentation

- Existing semantic surfaces, profit/loss colors and numeric typography; clearer day headings and aligned financial values.
- Local-calendar Hoje/Ontem/full-date labels without modifying stored timestamps or service ordering.
- Shift date separators explicitly use data_operacional, not the shift end timestamp; the existing operational-date formatter remains unchanged.
- Optional app and vehicle badges only appear when those existing fields are present.
- Responsive wrapping and larger touch targets for filters, delete and shift expansion; accessible export-date labels.

## Files

Changed: HistoryView.tsx, ShiftHistoryView.tsx, AGENTS.md, roadmap.md.

Added: historyDatePresentation.ts, historyDatePresentation.test.ts, HistoryView.test.tsx, ShiftHistoryView.test.tsx and this report. No files removed.

## Verification

- Date helper tests: today, yesterday across a month boundary, older date and local midnight separation.
- History regressions: existing vehicle/ride-type filtering, clearing filters and deletion dispatch.
- Shift regressions: a shift beginning on 2026-10-09 and ending on 2026-10-10 remains on operational date 09/10/2026; expansion, app filtering and clear-all remain functional.
- Authenticated Chromium: created a daily entry and analyzed ride through the existing forms; verified the ride in History after reload; deleted both verification records and confirmed the original empty History returned. No runtime errors were observed.
- Populated History screenshots inspected at 360×800 and 1280×1800; overflow checks passed at 360×800, 375×667, 360×420, 768×900 and 1280×1800.

## Limits

Browser viewport checks are not physical Android/Safari iOS, installed PWA or Capacitor validation. Populated shift behavior is covered by component tests, not a real completed-device shift. No claim of native-device validation or production release approval is made.