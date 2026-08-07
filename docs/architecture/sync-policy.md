# Visionário Drive — Política de Sincronização e Versionamento

Documento oficial. Atualizado na Sprint 1.6.

## 1. Camadas

```
Components → Services → Repositories → Storage/Cloud
```

- **Components** nunca importam `storage.ts`, `cloudSync.ts`, `supabase` (exceto auth), `expenses`, `expenseAnalytics`, `historyAggregation`.
- **Services** contêm regra de negócio e consomem apenas Repositories.
- **Repositories** são o único ponto físico de acesso a `localStorage`,
  `cloudSync` e Supabase (perfil).
- **Exceção documentada:** módulos Shift/GPS legados (`ShiftMode`,
  `ShiftLiveMap`, `ShiftHistoryView`, `RegisterRideFab`, `useShiftTracker`)
  ainda consomem `shifts.ts` diretamente por serem a raiz do tracking.
  Migram na Fase 2.

## 2. schemaVersion — padrão oficial

Todo payload persistido versionado segue o formato:

```json
{ "schemaVersion": 1, "entries": [ /* ... */ ] }
```

Versões oficiais (fonte: `src/lib/domain/models.ts`):

| Entidade   | Constante                    | Versão |
|------------|------------------------------|--------|
| Financial  | `FINANCIAL_SCHEMA_VERSION`   | 1      |
| Ride       | `RIDE_SCHEMA_VERSION`        | 1      |
| Vehicles   | `VEHICLES_SCHEMA_VERSION`    | 1      |
| Goals      | `GOALS_SCHEMA_VERSION`       | 1      |
| Settings   | `SETTINGS_SCHEMA_VERSION`    | 1      |
| Profile    | `PROFILE_SCHEMA_VERSION`     | 1      |

Novas entidades nascem com `SCHEMA_VERSION = 1`. Novas versões DEVEM ter
migrador declarado no repositório correspondente via
`BaseRepository.readVersioned(key, currentVersion, migrate, empty)`.

## 3. Estratégia de leitura

1. Ler `localStorage[key]`.
2. Se ausente → payload vazio com `schemaVersion` atual.
3. Se presente e `schemaVersion` atual → devolver.
4. Se presente e menor → aplicar migrador → devolver (e reescrever no
   próximo `write` — nunca no `read`, para evitar side-effects).

## 4. Estratégia de escrita (Sprint 10.4.9 — outbox durável)

- Toda escrita passa por `Repository.write(payload, { markCloud })`.
- `markDirty` **não** faz rede: registra a intenção em `vd-outbox`
  (`localStorage`). Isso sobrevive a kill do processo — o retry acontece no
  próximo boot, no evento `online` ou ao voltar ao foreground.
- Retry com backoff exponencial (1s → 2min). Falha de push **propaga** para
  manter a intenção viva na fila.
- Escritas de corrida (`vd-rides`) são sempre `{ immediate: true }`.
- `flushNow()` (awaitable) para telas críticas; `getSyncState()` expõe
  `idle | pending | syncing | error` para indicadores de UI.

## 5. Estratégia de merge (hidratação e realtime)

Regras defensivas aplicadas em `cloudSync.mergeIncomingForKey`:

- **Tombstones sempre vencem** — item apagado localmente nunca renasce
  via cloud (chaves cobertas: `entries`, `shifts`, `rides`).
- **Nunca rebaixar shift finalizado** — turno já `finalizado` local não
  pode voltar a `ativo`/`pausado` por causa de payload atrasado.
- **Union por id** — quando o cloud não conhece um item local ainda em
  voo, o local é preservado.

### 5.1 `vd-rides` — merge canônico (`mergeRidesPayload`)

1. Tombstone vence tudo.
2. União por `id` (UUID) — corrida offline nunca é sobrescrita.
3. Conflito no mesmo `id` → maior `updatedAt` vence (fallback `date`);
   empate → vence o LOCAL.

Coberto por `src/lib/cloudSync.merge.test.ts`.

### 5.2 Idempotência de captura

`RideModel.clientRequestId` é a chave de idempotência de toda interface de
entrada (form, notificação, quick form, GPS). `rideService.registerShiftRide`
rejeita reenvio por `clientRequestId` e, na ausência dele, por heurística
(mesmo valor+km no mesmo turno dentro de 20s).

Bônus/despesas vinculadas (`relatedRideId`) sobrevivem a delete do
ride pai apenas se tiverem `sourceRef` externo.

## 6. Sincronização

- **Formato de transporte:** `user_data` (Supabase) — 1 linha por
  usuário, 1 coluna por chave local.
- **Cadência:** debounced (300ms padrão, imediato em ops críticas).
- **Realtime:** `postgres_changes` re-hidrata aplicando `mergeIncomingForKey`.
- **Lifecycle:** `pagehide` / `beforeunload` / `visibilitychange:hidden`
  disparam flush best-effort com prévia dos buffers de turno.

## 7. Reset e ciclo de vida de dados

Toda operação destrutiva passa por `dataLifecycleService`:

- `resetAll()` — apaga tudo (registry em `APP_STORAGE_KEYS`), limpa
  tombstones, empurra estado vazio pro cloud imediatamente.
- `clearLocalCache()` — usada em logout/delete-account, limpa apenas o
  cache local sincronizável e preserva flags de dispositivo.

Nenhum outro Service pode expor API destrutiva.
