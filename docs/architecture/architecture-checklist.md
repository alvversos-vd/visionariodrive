# Architecture Checklist — Auditoria manual

> Rode este checklist antes de mergear qualquer PR estrutural.
> Cada item é **verificável** com `rg` (ripgrep) ou leitura manual.

## Componentes

- [ ] Nenhum `src/components/**` importa `@/lib/storage` (exceção: nenhum).
  ```bash
  rg -n "from ['\"]@/lib/storage" src/components && echo "VIOLAÇÃO"
  ```
- [ ] Nenhum `src/components/**` importa `@/lib/cloudSync`.
- [ ] Nenhum `src/components/**` importa `@/lib/repositories/*`.
- [ ] Nenhum `src/components/**` importa `@/integrations/supabase/client`
      fora de `Auth.tsx` / `AuthContext.tsx`.
- [ ] Nenhum componente contém fórmula de lucro/km/hora — só consome
      `metricsService`.
- [ ] Nenhum componente chama `localStorage` diretamente.

## Services

- [ ] Nenhum Service importa `src/components/**`.
- [ ] Nenhum Service importa outro Service para calcular métricas
      (exceto o próprio `metricsService`).
- [ ] Nenhum Service chama `cloudSync` diretamente
      (exceção: `dataLifecycleService.clearLocalCache`, que orquestra).
- [ ] Cada Service tem responsabilidade única (SRP).

## Repositories

- [ ] Nenhum Repository importa Services.
- [ ] Nenhum Repository importa Components.
- [ ] Toda entidade nova tem Repository correspondente.
- [ ] Cada Repository define exatamente **uma** storage key.

## Domain

- [ ] `RideModel` continua sendo o único modelo canônico
      (nenhum `RideModel_v2`, `RideModel_new`, etc.).
- [ ] `FinancialEntry` sem duplicatas.
- [ ] `schemaVersion` bumpado em toda mudança de shape persistido.

## Cloud Sync

- [ ] `cloudSync.ts` não contém regra de negócio.
- [ ] `Shift.rides` continua stripado no push e na hidratação.
- [ ] Nenhum bypass novo em outro arquivo.

## Tracking (exceção Shift)

- [ ] Apenas os arquivos listados na exceção da Sprint 2.5 importam
      `shifts.ts` diretamente.
- [ ] Nenhuma nova view importa `shifts.ts` sem justificativa em ADR.

## Comandos rápidos

```bash
# Componentes importando storage/cloud/repositories/supabase
rg -n "from ['\"]@/lib/(storage|cloudSync|repositories/)" src/components

# Services importando components
rg -n "from ['\"]@/components/" src/lib/services

# Repositories importando services
rg -n "from ['\"](\.\./)?services/" src/lib/repositories

# Uso direto de localStorage em components
rg -n "localStorage\." src/components

# Cálculos suspeitos fora do metricsService
rg -n "value\s*/\s*km|profit\s*=|lucro\s*=" src/components
```
