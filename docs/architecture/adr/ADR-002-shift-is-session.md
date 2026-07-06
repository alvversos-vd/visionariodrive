# ADR-002 — Shift representa sessão, nunca domínio de corridas

- **Status:** Aceito (Sprint 2.4, congelado em 2.5)

## Contexto

Historicamente `Shift` acumulava dois papéis: sessão de trabalho (start,
end, rota GPS, veículo) **e** container de corridas (`Shift.rides`).
Isso gerou dupla-escrita, cálculos duplicados em `computeTotals` e
acoplamento entre GPS/tracking e o domínio Ride.

## Problema

Enquanto `Shift` fosse dono de corridas, qualquer feature (edição,
export, PRO) precisava reconciliar duas fontes. Cloud sync duplicava
payload e tombstones não cobriam ambos.

## Decisão

`Shift` é **exclusivamente** uma sessão de trabalho. Persiste apenas:
`turno_id`, `veiculo_id`, `data_operacional`, `rota` (polyline GPS),
estado (`ativo`/`encerrado`), timestamps, `km_desde_ultima_corrida` e
`ultima_corrida_iso`. Corridas vivem em `RideRepository`
(ver ADR-001). `computeTotals(shift, rides: RideModel[])` é pura.

## Alternativas consideradas

1. **Manter `Shift.rides` como cache derivado** — reintroduz a
   possibilidade de divergência.
2. **Fundir Shift em RideModel** — perde o conceito de sessão contínua
   necessário para GPS/tracking.

## Consequências

- Menor superfície de bug; `Shift` é imutável quanto a corridas.
- `useShiftTracker` e `ShiftMode` consomem `rideService.listByShift`.
- Débito: coluna `rides` no cloud é ignorada/stripada, mas continua no
  schema até uma migração destrutiva futura.
