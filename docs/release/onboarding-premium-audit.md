# Premium onboarding — audit and validation

## Existing flow
- `App.tsx` ProtectedRoute waits for authentication and data hydration. Incomplete profiles render the existing Onboarding; completed profiles reach the requested protected page.
- Six existing screens: welcome, vehicle, daily goal, delivery app, objective, final review. No new screen or permission stage was introduced.
- Each personalization question remains optional. All selections remain local until completion; reloading an unfinished onboarding resets the draft, as before.
- Completion preserves the existing sequence: vehicleService (only if no vehicle exists), preferred app, goalsService, profileService.markOnboarded, refreshProfile, onFinish. Skip-all preserves profileService.update followed by refreshProfile and onFinish.
- The refreshed completion flag lets ProtectedRoute mount the dashboard. No routing/authentication code was edited.

## Problems found and addressed
- Emoji illustrations and inconsistent action colors: replaced with existing brand asset and Lucide icons, semantic primary actions.
- Clickable cards were inaccessible by keyboard: replaced with design-system Buttons with selected states.
- No backward navigation: added local Back navigation retaining entered values.
- Goal field lacked a visible label and comfortable sizing: added label, hint, 48px height and 16px text.
- Final screen claimed completion before saving: now displays a review and explicit save action.
- Skip-all had no failure recovery; welcome actions could submit multiple times: added ephemeral submission guard, disabled busy action and existing toast error feedback. Service calls and business rules unchanged.
- Delayed selection advancement was unnecessary: selection still advances immediately, without scheduling callbacks.

## Changed files
- `src/components/Onboarding.tsx`: existing presentation, accessible controls, local navigation and submission feedback.
- `src/components/Onboarding.test.tsx`: four interaction/persistence-contract regressions.
- `AGENTS.md`: ownership rule for the existing component and completion mechanism.
- `roadmap.md`: scoped task checklist.
- This report documents audit evidence and remaining validation limits.

## Validation evidence
- Full Vitest suite: 129 passing tests across 15 files. After a test typing adjustment, all four onboarding tests passed again.
- Onboarding tests verify retained selections, exact saved preferences (Carro, R$275, Uber, controlar_gastos), optional skips, one in-flight submission and retry after failure.
- ESLint on changed component/tests passed. Global lint still fails on three pre-existing errors in previewAuthStorage.ts, achievementService.ts and tailwind.config.ts; these prohibited/out-of-scope files were not edited.
- Automatic build/typecheck: latest observation `build OK`, 2026-10-09 04:30:32 UTC. No manual build/typecheck was run because the project harness performs them.
- Chromium authenticated browser check: completed requesting-user account bypassed onboarding.
- First-access presentation tested by intercepting profile responses as incomplete only inside the test browser. No completion/preference changes were written to the hosted account.
- Viewports checked: 1366×768, 1440×900, 360×800, 375×812, 812×375, and 375×420 reduced-height simulation. No horizontal overflow; primary touch targets at least 44px; custom goal uses 16px text.
- Keyboard Enter selected a vehicle; Back retained vehicle and custom goal; review displayed entered values; reload restored the original unfinished-state behavior. No page JavaScript errors observed.

## Limits
- First-access hosted completion and read-back were not exercised end-to-end on a real new account; saving was validated with service mocks, not a hosted write.
- Reduced-height simulation is not a real virtual keyboard test. Android Chrome/PWA/Capacitor, iOS Safari/PWA/Capacitor, real safe areas and physical keyboards still require device QA.
- No GPS, Shift, Quick Ride, permission, START/PRO, service, repository, database, EventBus or CloudSync files changed.