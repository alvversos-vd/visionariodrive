# ADR-007 — ShiftService como fachada pública oficial de tracking

- **Status:** Aceito (Sprint 3)
- **Substitui parcialmente:** exceção documentada em ADR-004

## Contexto

Do Sprint 2.1 até 2.5, os componentes de tracking (`ShiftMode`,
`ShiftLiveMap`, `ShiftHistoryView`, `RegisterRideFab`, `useShiftTracker`
e o badge de turno no `Dashboard`) continuavam importando `src/lib/shifts.ts`
diretamente — a única exceção viva da arquitetura em camadas
(`Components → Services → Repositories → Storage`). A exceção foi
documentada no ADR-004 sob a condição de ser encerrada na Fase 3.

## Problema

Manter `shifts.ts` como API pública de UI cria três riscos estruturais:

1. Bypass da camada de Services — componentes ganham acesso a helpers
   de storage/tracking sem passar por regra de negócio.
2. Ciclos e acoplamento — hooks/UI conhecem detalhes de infraestrutura
   (buffers de GPS, formatação, meta de turno) em vez de intenções.
3. Bloqueio evolutivo — impossível trocar a implementação de tracking
   (por exemplo, integrar detecção automática de rides) sem refatorar
   toda a UI.

## Decisão

Introduzir `src/lib/services/shiftService.ts` como **fachada pública
oficial** para tudo relacionado a Shift/tracking. Ele:

- Delega 100% para `shifts.ts` e `rideService` — **zero cálculo próprio**,
  **zero persistência própria**, **zero regra de negócio própria**.
- Expõe a API canônica: `getActive`, `list`, `start`, `end`, `endAtomic`,
  `pause`, `resume`, `remove`, `getTotals` (orquestra rides + computeTotals),
  `metaProgresso`, `classifyRide`, helpers de formatação, primitivas de
  tracking (`appendRoutePoint`, `addGpsDistance`, `flushBuffers`,
  `setGpsStatus`, `clearRoute`, `clearAllRoutes`) e o barramento reativo
  (`subscribe`, `getVersion`).
- É a **única** superfície importada por componentes/hooks. Nenhum
  arquivo em `src/components/**` ou `src/hooks/**` importa `@/lib/shifts`.

`src/lib/shifts.ts` continua sendo a implementação (owner físico do
`Shift`, buffers de GPS, upsert de DailyEntry derivado, migração de
`Shift.rides` legacy). Passa a emitir `shift:changed` no `saveShifts`
para alimentar hooks reativos via `eventBus`.

## Alternativas consideradas

1. **Manter a exceção** — bloqueia a evolução da Fase 3 e cria pressão
   para novas exceções.
2. **Absorver `shifts.ts` inteiro em `shiftService`** — mistura fachada
   com implementação, exige mover buffers de GPS e regras de sessão
   para dentro do service (mais risco, sem ganho).
3. **Fatiar em vários services (`shiftReadService`, `shiftGpsService`,
   `shiftLifecycleService`)** — sobre-engenharia para o tamanho atual;
   fica reservado para quando a superfície justificar.

## Consequências

- Componentes ficam finos: `Dashboard` passa a consumir `useDashboard()`,
  que encapsula `goalsService + settingsService + metricsService +
  shiftService` em uma única leitura reativa.
- Novas features (GPS automático, IA, insights) podem trocar a
  implementação de `shifts.ts` sem tocar em UI.
- A exceção do ADR-004 é **encerrada**. `architecture-rules.md` remove
  a lista de arquivos que ainda podiam importar `shifts.ts` direto.
- `shifts.ts` é reclassificado como **infrastructure** — só pode ser
  importado por `shiftService`, `rideService`, `rideRepository`
  (migração one-shot), `cloudSync` e `exportShifts`.

## Notas de implementação

- `shiftService.getTotals(shift)` orquestra:
  `computeTotals(shift, rideService.listByShift(shift.turno_id))`.
- `shiftService.subscribe` re-exporta `eventBus.subscribe('shift:changed', cb)`.
- Nenhuma alteração de UX, tracking, GPS ou APIs congeladas.
