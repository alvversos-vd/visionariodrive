# Release Freeze — Visionário Drive Start v1.0.0

**Status oficial:** 🔒 RELEASE FREEZE ATIVO
**Versão:** 1.0.0 (versionCode 1)
**Data:** 2026-07-12
**Health Score:** 9.85 / 10
**Última Sprint:** 5.6 — GO / NO-GO Review (aprovado GO)
**Responsável:** CTO / Owner do projeto
**Artefato oficial:** `VisionarioDrive-1.0.0.aab`

---

## 1. Critérios que sustentam o Freeze

- Typecheck ✅ 0 errors (16 warnings `react-refresh/only-export-components` aceitos)
- Build Web ✅ · Build Android AAB ✅ · PWA ✅
- Segurança ✅ (RLS, policies escopadas a `auth.uid()`, edge function `delete-account` valida JWT, `supabase--linter` = 0)
- LGPD ✅ (política, termos, consentimentos GPS/BG/notificações, exportação, exclusão de conta, sem PII em telemetria)
- Performance ✅ (lazy loading de 9 views, sem polling, memória estável em turno longo)
- GPS foreground/background ✅ — `AutoRideToast` P0 corrigido
- Offline + Cloud Sync ✅ — merge defensivo, tombstones, `flushNow` em ações críticas
- UX 8.5/10 ✅ — pronto para motoristas reais

---

## 2. Itens PERMITIDOS durante o Release Freeze

Apenas correções reativas descobertas em campo:

- Crash em runtime
- Bug P0 (bloqueia core: turno, GPS, tracking, financeiro)
- Bug P1 (fluxo crítico degradado sem workaround)
- Problema de LGPD (consentimento, PII, exportação, exclusão)
- Problema de Segurança (RLS, autenticação, edge function, secret)
- Problema de conformidade Google Play (Data Safety, permissions, política)

Qualquer correção permitida DEVE:
1. Ser rastreada em `docs/release/beta-feedback.md` ou `docs/release/post-launch-monitoring.md`.
2. Ser mínima e cirúrgica — nada além do necessário para restaurar o comportamento.
3. Não alterar API pública, arquitetura, camadas, Services, Repositories, EventBus ou fluxos.
4. Incrementar `versionCode` e ajustar `versionName` (patch: 1.0.1, 1.0.2, …).

---

## 3. Itens PROIBIDOS durante o Release Freeze

- Novas funcionalidades
- Refactors (mesmo "pequenos")
- Mudanças visuais / redesign
- Gamificação, badges, streaks visuais novos
- Heatmap
- Qualquer entrega do Plano PRO
- IA / LLM / insights avançados
- Novos Dashboards
- Novos Services / Hooks / Repositories / Owners
- Mudanças arquiteturais
- Mudanças em ADRs 001–008
- Reordenação de camadas
- Alteração de contratos públicos em `docs/architecture/public-api.md`

Qualquer ideia nova → **exclusivamente** para `docs/architecture/roadmap.md` (Sprint 6, Sprint 7, PRO ou Futuro).

---

## 4. Escopo do artefato

- `applicationId`: `app.lovable.fa6584b5282341a1b19d2e91ce68bac4`
- `versionCode`: **1**
- `versionName`: **1.0.0**
- `minSdk`: 24 · `targetSdk`: 36 · `compileSdk`: 36
- `capacitor.config.ts`: sem `server.url` no build de release
- Permissões declaradas e justificadas em `AndroidManifest.xml`
- Assinatura: **Play App Signing** (Google guarda a chave final); upload key gerada localmente e nunca commitada

---

## 5. Governança do Freeze

- Toda alteração deve abrir entrada em `beta-feedback.md` **antes** do commit.
- Toda alteração deve referenciar categoria: Crash | P0 | P1 | LGPD | Segurança | Play Store.
- Toda alteração deve incluir smoke test em aparelho físico antes de publicar patch.
- Fim do Freeze: apenas após decisão explícita do owner + nova Sprint aberta com escopo claro.

---

**Assinatura:** Visionário Drive Start v1.0.0 — RELEASE FREEZE — 2026-07-12
