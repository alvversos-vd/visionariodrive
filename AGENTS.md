# Architecture rules

- Keep tutorial presentation separate and account-keyed inside Index, using its existing navigation and explicit data-tutorial targets; reuse engagement.ts for per-user local visual preferences to avoid a new persistence layer or operational side effects.

- Keep responsive tab presentation in TabNavigation with local open state and a single supplied item list; Index owns selection and access rules so menu interactions cannot duplicate domain logic.
- Keep onboarding presentation and ephemeral navigation in the existing Onboarding component; preserve service-backed completion and AuthContext gating to avoid a second persistence or routing mechanism.
- Keep diagnostic controls in normal document flow and gated by their existing explicit activation mechanisms; native platform detection alone must not expose debug UI to ordinary users.
- Keep financial-screen polish in FinancialView and EntryForm presentation; retain existing service calls, filters and calculations unchanged so visual refinement cannot change financial meaning or persistence.
- Keep history date labels in a presentation-only helper and existing history views; preserve service ordering, local calendar interpretation and shift operational dates so visual grouping never reassigns records.
- Render achievement glyphs through the small ID-based AchievementIcon presentation component; keep the catalog and persisted achievement contracts untouched so icon changes cannot affect rewards or progression.
- Reuse local Lucide-compatible vehicle glyphs for motorcycle and electric bicycle presentation so all vehicle selectors stay consistent without changing domain types.
- Keep achievement card presentation shared by profile and modal; consume hook-provided progress without recomputing requirements or rewards so visual polish cannot change progression.