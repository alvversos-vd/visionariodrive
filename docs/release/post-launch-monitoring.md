# Post-Launch Monitoring — Visionário Drive Start v1.0.0

Checklist operacional diário durante o Beta Fechado e primeiras semanas em Produção.

## Cadência

- **Diário** (07:00 e 20:00 BRT) — varredura dos 7 pilares abaixo
- **Semanal** (segunda 09:00) — consolidação + relatório resumido
- **Incidente** — qualquer P0/P1 abre entrada imediata em `beta-feedback.md`

---

## 1. Pilares monitorados

| # | Pilar | O que verificar | Fonte | Ação se detectado |
|---|-------|-----------------|-------|-------------------|
| 1 | Crash | ANR / crash nativo Android | Play Console → Vitals | Registrar + reproduzir + patch P0 |
| 2 | Erro GPS | Watcher parado, permissão negada, coords inválidas | `gpsTelemetry` events, feedback beta | Diagnóstico via `permissionDiagnostic` |
| 3 | Erro Cloud Sync | Falha em `flushNow`, merge inconsistente, tombstone renascido | `telemetry` + logs edge | Verificar RLS + `updated_at` |
| 4 | Erro Login | Falha Supabase Auth, OAuth Google, sessão perdida | Feedback + logs edge | Checar provider + redirect_uri |
| 5 | Erro Exportação | PDF/GPX/KML falhando | Feedback beta | Verificar `saveBlob` no dispositivo |
| 6 | Erro Turno | Turno não inicia, não encerra, km divergente | Feedback + `shiftService` | Checar `endAtomic` + Cloud Sync |
| 7 | Erro Ride Detection | Auto-ride não dispara, falso positivo, toast quebrado | Feedback + `rideDetectionService` | Revisar thresholds em `rideDetectionConfig` |

---

## 2. Registro de ocorrências

| Data | Pilar | Severidade | Motorista/Sessão | Descrição | Reproduzível? | Ação | Status |
|------|-------|------------|------------------|-----------|---------------|------|--------|
|      |       |            |                  |           |               |      |        |

Severidade: **P0** (crash/perda de dados) · **P1** (fluxo crítico) · **P2** (workaround existe) · **P3** (cosmético)

---

## 3. Fontes de dados

- **Play Console → Vitals** — ANR, crashes, tempo de startup
- **Supabase logs** — edge function `delete-account`, auth events
- **`telemetry` local** — eventos one-shot (`recordMigration`, sync flush, GPS)
- **`gpsTelemetry`** — GPS accuracy, fix source, hidden flag
- **Feedback do beta** — planilha + `beta-feedback.md`

⚠ **Nunca** logar PII, coordenadas brutas, tokens, email ou ID pessoal.

---

## 4. Gatilhos automáticos de patch

Um patch (1.0.1, 1.0.2, …) pode ser publicado durante o Freeze **apenas** se:

- Crash rate > 0.5% em 24h → hotfix P0
- Falha de login > 2% em 24h → hotfix P0
- Falha de Cloud Sync > 1% em 24h → hotfix P1
- Perda de dados confirmada em qualquer sessão → hotfix P0 imediato
- Violação LGPD ou Segurança confirmada → hotfix imediato + comunicado

---

## 5. Métricas alvo (primeiros 30 dias)

| Métrica | Alvo | Vermelho |
|---------|------|----------|
| Crash-free sessions | ≥ 99.5% | < 99.0% |
| ANR rate | < 0.20% | ≥ 0.47% (limite Google) |
| Startup médio (cold) | < 2.5s | > 5s |
| Falha de sync | < 0.5% | > 1% |
| Falha de login | < 1% | > 2% |
| Falha de GPS em turno | < 2% | > 5% |

---

## 6. Consolidação semanal

- Semana 1: _(vazio)_
- Semana 2: _(vazio)_
- Semana 3: _(vazio)_
- Semana 4: _(vazio)_
