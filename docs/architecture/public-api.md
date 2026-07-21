# Public API — Visionário Drive (FROZEN)

> **Sprint 2.5 — Architecture Freeze.** As assinaturas abaixo constituem o
> contrato público entre a camada de **Components (React)** e a camada de
> **Services**. Qualquer alteração exige uma nova ADR e uma sprint dedicada
> de migração. Componentes **NÃO** podem consumir Repositories, `storage.ts`,
> `cloudSync.ts` ou o cliente Supabase (fora de Auth) diretamente.
>
> Nomenclatura:
>
> - **PUBLIC** — chamável por componentes.
> - **INTERNAL** — chamável apenas por outros Services (ou pelo próprio
>   Service que declarou). Não usar em componentes React.

---

## 1. RideService — `src/lib/services/rideService.ts`

**Owner do domínio:** `RideModel` (via `RideRepository`).
**Entidade alterada:** `vd-rides` (canônico) + `Shift` (sessão, via
`markRideRegistered` — nunca escreve em `Shift.rides`).

### PUBLIC

| Método | Params | Retorno | Responsabilidade | Efeitos |
|--------|--------|---------|------------------|---------|
| `list(filters?)` | `RideListFilters` | `RideModel[]` | Lista corridas filtradas (captureMode/app/vehicle/shift/from/to) | leitura |
| `listByDay(date?)` | `Date` | `RideModel[]` | Corridas de um dia operacional | leitura |
| `listByShift(shiftId)` | `string` | `RideModel[]` | Todas as corridas de um turno | leitura |
| `groupByShift()` | — | `Map<shiftId, RideModel[]>` | Agrupamento para relatórios | leitura |
| `getById(id)` | `string` | `RideModel \| null` | Busca por id | leitura |
| `countIndividual()` | — | `number` | Total de rides manual+quick | leitura |
| `saveManualRide(input)` | `SaveIndividualInput` | `RideModel` | Fluxo RideAnalyzer (com analysis snapshot) | escreve `vd-rides` |
| `saveQuickRide(input)` | `RideInput` | `RideModel` | Captura rápida (valor+km) | escreve `vd-rides` |
| `addGpsRide(input)` | `GpsRideInput` | `RideModel` | GPS puro fora de turno | escreve `vd-rides` |
| `addRide(input, mode?)` | `RideInput`, `CaptureMode` | `RideModel` | Escrita genérica canônica | escreve `vd-rides` |
| `updateRide(id, patch)` | `string`, `Partial<RideModel>` | `RideModel \| null` | Patch parcial | escreve `vd-rides` |
| `deleteRide(id)` | `string` | `void` | Remove definitivamente | escreve `vd-rides` |
| `registerShiftRide(input)` | `RegisterShiftRideInput` | `RideModel \| null` | Registra corrida em turno ativo | escreve `vd-rides`, muta sessão do `Shift` |
| `updateShiftRide(id, patch)` | `string`, `{km?,valor?}` | `RideModel \| null` | Edita com histórico | escreve `vd-rides` |
| `deleteShiftRide(id)` | `string` | `void` | Remove corrida do turno | escreve `vd-rides` |
| `restoreShiftRide(snap)` | `ShiftRide` | `RideModel \| null` | Undo de delete | escreve `vd-rides` |
| `revertLastShiftRideEdit(id)` | `string` | `RideModel \| null` | Desfaz última edição | escreve `vd-rides` |
| `undoLastRide()` | — | `string \| null` | Sprint 7 · CP2 — remove a corrida mais recente (delega em `deleteRide`). Usado apenas pelo `NotificationActionService`. | escreve `vd-rides` |

### INTERNAL

Nenhuma. Todo helper (`buildRide`, `reclassify`, `findShift`, `inRange`,
`startOfDay`, `endOfDay`) é privado ao módulo.

---

## 2. FinancialService — `src/lib/services/financialService.ts`

**Owner:** `FinancialEntry` (via `FinancialRepository` → `vd-financial`).

### PUBLIC

| Método | Retorno | Responsabilidade |
|--------|---------|------------------|
| `list(filters?)` | `FinancialEntry[]` | Lista entries (type/vehicle/from/to) |
| `getById(id)` | `FinancialEntry \| null` | Busca |
| `add(input)` | `FinancialEntry` | Cria income/bonus/expense |
| `update(id, patch)` | `FinancialEntry \| null` | Edita |
| `remove(id)` | `void` | Remove |
| `summary(range?)` | `FinancialSummary` | Total income / expense / net |

### INTERNAL

Helpers de normalização (`normalizeAmount`, `bucketByType`) permanecem
privados ao módulo.

---

## 3. MetricsService — `src/lib/services/metricsService.ts`

**ÚNICO local autorizado a calcular:** lucro, R$/km, R$/hora, streak,
insights, comparativos.

### PUBLIC

| Método | Retorno | Responsabilidade |
|--------|---------|------------------|
| `analyzeRide({value, km, ...})` | `RideAnalysis` | Custo/km, mínimo ideal, lucro, verdict |
| `dailyMetrics(date?)` | `DailyMetrics` | Total, R$/km, R$/h, corridas do dia |
| `weeklyMetrics()` | `WeeklyMetrics` | Agregação semanal |
| `monthlyMetrics()` | `MonthlyMetrics` | Agregação mensal |
| `streak()` | `StreakInfo` | Sequência de dias trabalhados |
| `compare(a, b)` | `PeriodCompare` | Comparativo entre períodos |
| `insights()` | `Insight[]` | Insights derivados (nunca em componentes) |

### INTERNAL

Todas as funções de agregação (`aggregateByVehicle`, `costModel`, etc.)
são internas — nunca importadas por componentes ou outros services fora
das APIs listadas acima.

---

## 4. VehicleService — `src/lib/services/vehicleService.ts`

**Owner:** `Vehicle` (via `VehicleRepository`).

### PUBLIC

- `list()` → `Vehicle[]`
- `getById(id)` → `Vehicle | null`
- `getActive()` → `Vehicle | null`
- `add(input)` → `Vehicle`
- `update(id, patch)` → `Vehicle | null`
- `remove(id)` → `void`
- `setActive(id)` → `void`

---

## 5. GoalsService — `src/lib/services/goalsService.ts`

**Owner:** `Goals` (via `GoalsRepository`).

### PUBLIC

- `get()` → `Goals`
- `save(goals)` → `void`
- `getDaily()` → `number`
- `saveDaily(amount)` → `void`
- `getSavingsDaily()` → `number`

---

## 6. SettingsService — `src/lib/services/settingsService.ts`

**Owner:** `Settings` (via `SettingsRepository`).

### PUBLIC

- `get()` → `Settings`
- `save(patch)` → `Settings`
- `getVehicle()` → `VehicleSettings`
- `getConsents()` → `Consents`
- `setConsent(key, value)` → `void`

> **Nota arquitetural:** `SettingsService` **não** possui mais responsabilidade
> destrutiva. `resetAllData` foi movido para `DataLifecycleService`.

---

## 7. ProfileService — `src/lib/services/profileService.ts`

**Owner:** `Profile` (via `ProfileRepository`).

### PUBLIC

- `get()` → `Profile`
- `save(patch)` → `Profile`
- `getPlan()` → `'start' | 'pro'`

---

## 8. DataLifecycleService — `src/lib/services/dataLifecycleService.ts`

**Owner:** ciclo de vida do dado local. **Única API destrutiva do app.**

### PUBLIC

- `resetAll()` → `void` — apaga TODO estado local + push cloud vazio
- `clearLocalCache()` → `void` — limpa apenas cache gerenciado por cloudSync
  (logout / troca de conta)

---

## 9. ShiftService — `src/lib/services/shiftService.ts` (Sprint 3, ADR-007)

**Fachada oficial** para tudo relacionado a `Shift`. **Sem regra de
negócio própria** — delega a `shifts.ts` (infra) e `rideService`
(corridas canônicas).

### PUBLIC

- `getActive()` → `Shift | null`
- `list()` → `Shift[]`
- `start(opts)` / `end(id)` / `endAtomic(id)` / `pause(id)` / `resume(id)` / `remove(id)`
- `getTotals(shift)` → `ShiftTotals` (orquestra `rideService.listByShift`
  + `computeTotals` puro)
- `metaProgresso(shift, lucro)` / `classifyRide(valor, km, shift?)`
- `formatTempo` / `formatOperationalDate` / `todayOperationalDate` /
  `yesterdayOperationalDate`
- Tracking primitives: `appendRoutePoint`, `addGpsDistance`,
  `flushBuffers`, `setGpsStatus`, `clearRoute`, `clearAllRoutes`
- `subscribe(cb)` → `unsubscribe` (barra `shift:changed`)
- `getVersion()` → `number`

Componentes **NÃO** importam `@/lib/shifts` — apenas `shiftService`.

---

## 10. Hooks Layer — `src/hooks/*` (Sprint 3)

Camada oficial entre Components e Services. Baseada em
`useSyncExternalStore` + `eventBus`. **Zero polling.**

- `useDashboard(refresh?)` → `{ goals, settings, snapshot, activeShift, shiftTotals, insights }`
- `useRides(filters?)` / `useRidesByShift(id)` / `useRidesByDay(date?)`
- `useFinancialEntries(filters?)`
- `useDayMetrics(date?)` / `useDashboardSnapshot(goal)` / `useInsights(goal)`
- `useActiveShift()` / `useShifts()` / `useShiftTotals(shift)`

Componentes de UI **devem** preferir hooks a chamadas diretas ao Service
sempre que a leitura for reativa.

---

## Regras de congelamento

1. **Adição** de método público requer ADR.
2. **Remoção / rename** de método público requer sprint de migração
   dedicada + ADR.
3. **Mudança de assinatura** (params/retorno) é *breaking* — proibida sem
   ADR + bump de `schemaVersion` quando toca persistência.
4. Componentes **nunca** importam nada fora desta lista.

