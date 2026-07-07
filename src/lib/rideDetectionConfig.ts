/**
 * RideDetectionConfig — Sprint 4.
 *
 * Contrato de configuração da detecção automática de corridas.
 *
 * Toda regra é DETERMINÍSTICA e configurável. Nada hardcoded no service.
 * Sprint 4 lê apenas os defaults; a arquitetura já está preparada para
 * receber overrides (por motorista, por perfil, calibração) em sprints
 * futuras sem alterar o service.
 */

export interface RideDetectionConfig {
  /** Liga/desliga o detector inteiro (kill-switch de segurança). */
  enabled: boolean;
  /** Velocidade acima da qual consideramos "em movimento". */
  startSpeedKmh: number;
  /** Distância mínima acumulada para considerar corrida válida. */
  minRideMeters: number;
  /** Duração mínima em segundos para considerar corrida válida. */
  minRideSeconds: number;
  /** Velocidade abaixo da qual consideramos "parado". */
  stopSpeedKmh: number;
  /** Segundos de parada contínua para finalizar a corrida. */
  stopDurationSeconds: number;
  /** Gap mínimo (segundos) entre fim de uma corrida e início da próxima. */
  minGapSeconds: number;
  /** Velocidade máxima plausível (filtro anti-jitter GPS). */
  maxSpeedKmh: number;
  /** Score mínimo (0–100) para considerar detecção confiável. */
  minConfidence: number;
  /** Timeout do estado Pending antes de auto-confirmar (segundos). */
  pendingTimeoutSeconds: number;
  /** Janela de desfazer após salvar (segundos). */
  undoWindowSeconds: number;
}

export const DEFAULT_RIDE_DETECTION_CONFIG: Readonly<RideDetectionConfig> = Object.freeze({
  enabled: true,
  startSpeedKmh: 8,
  minRideMeters: 400,
  minRideSeconds: 90,
  stopSpeedKmh: 3,
  stopDurationSeconds: 120,
  minGapSeconds: 45,
  maxSpeedKmh: 160,
  minConfidence: 60,
  pendingTimeoutSeconds: 15,
  undoWindowSeconds: 6,
});

/**
 * Retorna a config ativa.
 *
 * Sprint 4: retorna apenas os defaults. A assinatura já suporta overrides
 * — próximas sprints podem mesclar com settingsService sem alterar
 * `rideDetectionService`.
 */
export function getRideDetectionConfig(): RideDetectionConfig {
  return { ...DEFAULT_RIDE_DETECTION_CONFIG };
}
