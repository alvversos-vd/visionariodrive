# ADR-010 — Cloud Sync da Gamificação

- **Status:** Aceito (Sprint 6.2.5, 2026-07-16)
- **Contexto:** Sprint 6.2 entregou XP+Conquistas persistidos apenas no `localStorage`. Ao reinstalar/trocar de aparelho, o motorista perdia o progresso. A ADR-009 exige que gamificação seja "cidadão de primeira classe" da arquitetura — sem sincronizador paralelo.

## Decisão

1. **Nenhuma tabela nova.** O payload de gamificação vive em uma nova coluna `gamification` (jsonb) na tabela `user_data`, reutilizando as RLS existentes (`auth.uid() = user_id` + `has_role admin`).

2. **Owner ÚNICO: `gamificationRepository`** (chave `vd-gamification`, `schemaVersion=1`) com formato:

   ```json
   {
     "schemaVersion": 1,
     "xp": { "totalXp": 4150 },
     "achievements": [{ "id": "...", "unlockedAt": "ISO" }],
     "stats": { "rides": 120, "distanceKm": 1425, "turns": 44, "earnings": 6842.30, "longestShiftMinutes": 760, "currentStreak": 12 },
     "updatedAt": "ISO8601"
   }
   ```

3. **`xpRepository` e `achievementRepository` viram adapters finos** sobre `gamificationRepository`, preservando 100% das APIs públicas (`read/write/reset`). Nenhum service ou hook é alterado.

4. **CloudSync existente reutilizado.** `KEY_MAP` ganha `'vd-gamification' → 'gamification'`. O `mergeIncomingForKey` do CloudSync recebe uma branch dedicada que delega a `mergeGamification` (função pura, testável).

5. **Merge determinístico:**
   - `xp.totalXp` → **máximo** (nunca reduz).
   - `achievements` → **união por id**, preservando `unlockedAt` mais antigo.
   - `stats` → **máximo campo a campo** (streak/turno/faturamento nunca caem).
   - `updatedAt` → ISO mais recente.

6. **Nível é sempre recalculado** a partir de `totalXp` via `levelForXp()` (Sprint 6.2). Nunca confiar em `level` salvo.

7. **EventBus estende dois eventos**: `gamification:synced` (após push bem-sucedido) e `gamification:merged` (após aplicar merge de cloud). Nenhum payload, sem PII.

8. **Telemetria (sem PII):** `gamification_sync`, `gamification_merge`, `gamification_conflict` — contadores agregados em `vd-telemetry-gamification`.

9. **Offline preservado.** Fluxo idêntico ao resto do app: escrita local → `markDirty` → CloudSync empurra quando houver rede. Nenhum código específico de "offline".

## Alternativas rejeitadas

- **Tabela dedicada `user_gamification`.** Duplicaria owner, exigiria novas RLS/GRANTs, quebraria a fundação do CloudSync.
- **Sincronizador próprio via Realtime channel específico.** Bypass explícito do pipeline oficial — proibido pela ADR-009.
- **LWW puro por `updatedAt`.** Poderia REDUZIR XP em race conditions; substituído por merge determinístico.

## Consequências

- Um único ponto físico de escrita/leitura para gamificação.
- Zero API pública alterada (xp/achievement repositories preservados).
- Testes cobrem primeiro sync, merge local↔cloud, conflito, offline, reinstall, troca de aparelho, reset, schemaVersion e retrocompatibilidade.
