# Architecture rules

- Keep responsive tab presentation in TabNavigation with local open state and a single supplied item list; Index owns selection and access rules so menu interactions cannot duplicate domain logic.
- Keep onboarding presentation and ephemeral navigation in the existing Onboarding component; preserve service-backed completion and AuthContext gating to avoid a second persistence or routing mechanism.
- Keep diagnostic controls in normal document flow and gated by their existing explicit activation mechanisms; native platform detection alone must not expose debug UI to ordinary users.
- Keep financial-screen polish in FinancialView and EntryForm presentation; retain existing service calls, filters and calculations unchanged so visual refinement cannot change financial meaning or persistence.