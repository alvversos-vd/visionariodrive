# Dashboard mobile — final presentation audit

## Findings and changes
- ExportDebugButton was unconditionally enabled despite its documented `exportDebug=1` opt-in. Restored that existing activation condition.
- GpsDebugButton enabled itself for all native/WebView users. Removed platform auto-activation and retry timers; retained `gpsDebug=1`, the existing saved shortcut and its activation event.
- Both diagnostic controls were fixed overlays. They now occupy normal document flow only when explicitly enabled; export operations are unchanged. These existing switches are diagnostic opt-ins, not an administrative authorization mechanism.
- Index had only 32px bottom spacing. Added bottom clearance plus `safe-area-inset-bottom`; adjusted only the RegisterRideFab bottom offset to respect the same system inset.
- TabNavigation mobile items now have a 44px minimum target, reduced vertical gaps, wrapping labels and a scrollable panel constrained by Radix's available viewport height. Outside-click, Escape, selection closing, indicators and expanded tablet/desktop presentation are preserved.
- OperationalStatusBadge already returns no UI and makes no diagnostic subscription/request when GPS capability is disabled. No change to the badge or its permission behavior was required. PRO configuration event and current manual message remain intact.
- Dashboard hero and Iniciar turno presentation, data and calculations were left unchanged.

## Files changed
- src/components/ExportDebugButton.tsx
- src/components/GpsDebugButton.tsx
- src/components/TabNavigation.tsx
- src/components/RegisterRideFab.tsx (bottom position only)
- src/pages/Index.tsx (bottom spacing only)
- src/components/DiagnosticControls.test.tsx
- src/components/OperationalStatusBadge.test.tsx
- AGENTS.md, roadmap.md and this report

## Evidence
- Vitest: 17 files, 135 passing tests. Tests cover explicit diagnostic opt-ins and export calls, START absence/no diagnostic requests, PRO configuration action, and existing navigation interactions.
- Applicable ESLint passed on every changed application/test file.
- Automatic compilation/typecheck: latest observed entry `build OK`, 2026-10-09 20:48:03 UTC. No manual compilation/typecheck was run.
- Chromium with the requesting user's real authenticated session: Dashboard mounted; seven menu destinations; no horizontal overflow at 360×800, 375×667, 360×420, 714×677 and desktop 1280×1800. Stable menu target height was 44px.
- At 360×420 the panel bottom was 404px, preserving 16px viewport clearance, with internal scrolling for remaining items. The navigation content itself exceeds the panel height by design.
- Ordinary Dashboard showed neither diagnostic control nor the manual GPS status badge. Explicit URL opt-in exposed diagnostics; exporting a snapshot produced a browser download. No page runtime errors.
- Existing first-session dialogs were dismissed through normal UI before navigation checks. No hosted profile or business data were edited.

## Limits
- Browser viewport tests are not physical Samsung A07, Android PWA/Capacitor or iOS validation. Real system navigation insets still require device QA; browser evidence alone cannot certify them.
- The current upload contained the written brief, not the two A07 screenshots cited in it. No claim of pixel matching those references is made.
- PRO badge behavior was tested with controlled capability/diagnostic mocks, not by changing the requesting user's plan.
- No services, repositories, public hooks, models, authentication, permissions, tracking, EventBus or CloudSync were changed.