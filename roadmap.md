# Premium onboarding
- [x] Audit and implement separate interactive tutorial with user-scoped presentation preference and permanent help.
- [x] Reuse engagement storage without a new persistence layer; use explicit stable targets and clear visual state on account/session changes.
- [x] Verify tutorial navigation, account isolation, persistence, accessible target positioning and absence of operational writes; 161 tests passed; results and physical-device limitations documented in docs/release/tutorial-premium-audit.md.
- [x] Refine existing achievement cards and modal using real rarity, XP and progress; 147 tests and authenticated checks in five viewports passed; physical Android/iOS remain unverified.
- [x] Correct motorcycle and electric bicycle glyphs in existing selectors; six regression tests and authenticated desktop/mobile rendering passed (physical Android/iOS not tested).
- [x] Audit existing onboarding and persistence flow.
- [x] Refine existing presentation and accessible navigation without domain changes.
- [x] Run interaction regressions and browser viewport checks; report device limitations in docs/release/onboarding-premium-audit.md.

# Dashboard mobile refinement
- [x] Audit diagnostic controls and navigation presentation.
- [x] Restrict diagnostics to existing explicit activation and remove floating overlap.
- [x] Compact mobile menu and protect available height and bottom safe area.
- [x] Verify START/PRO presentation and regression tests; document physical device limitations in docs/release/dashboard-mobile-audit.md.

# Financeiro premium · Gate 2
- [x] Audit current indicators, filters, dates, form and design tokens.
- [x] Refine FinancialView and EntryForm presentation only; preserve existing calculations and actions.
- [x] Verify regressions and authenticated browser layout; document results and physical-device limitations in docs/release/financial-premium-audit.md.

# Histórico premium · Gate 3
- [x] Padronizar iconografia global com Lucide; relatório e limites em docs/release/iconography-premium-audit.md.
- [x] Audit existing history sources, filters, optional fields and operational dates.
- [x] Refine current history cards and day headings without changing ordering or domain behavior.
- [x] Verify regression tests and browser interactions; document results and device limitations in docs/release/history-premium-audit.md.