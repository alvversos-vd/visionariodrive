/**
 * RideService — CONTRATO PÚBLICO (assinaturas apenas).
 *
 * A implementação real entra na Fase 2 da consolidação START/PRO. Nesta fase
 * nenhum componente deve depender deste serviço; o objetivo é apenas congelar
 * a superfície pública para que o MetricsService já dependa do contrato
 * correto e a migração futura não precise mexer em consumidores.
 *
 * Não invocar nenhum método deste módulo em Fase 1 — todos lançam.
 */

import type { RideModel, CaptureMode, RideApp } from '../domain/models';

export interface RideListFilters {
  captureMode?: CaptureMode | CaptureMode[];
  app?: RideApp;
  vehicleId?: string;
  from?: Date;
  to?: Date;
}

export interface NewRideInput {
  captureMode: CaptureMode;
  value: number;
  km: number;
  date?: string;
  durationMin?: number;
  app?: RideApp;
  vehicleId?: string;
  notes?: string;
  gps?: RideModel['gps'];
}

const NOT_IMPLEMENTED = (method: string): never => {
  throw new Error(
    `RideService.${method} ainda não implementado — disponível na Fase 2.`,
  );
};

export const rideService = {
  list(_filters: RideListFilters = {}): RideModel[] { return NOT_IMPLEMENTED('list'); },
  getById(_id: string): RideModel | null { return NOT_IMPLEMENTED('getById'); },
  add(_input: NewRideInput): RideModel { return NOT_IMPLEMENTED('add'); },
  remove(_id: string): void { return NOT_IMPLEMENTED('remove'); },
  sumByApp(_from: Date, _to: Date): Record<string, number> { return NOT_IMPLEMENTED('sumByApp'); },
};

export type RideService = typeof rideService;
