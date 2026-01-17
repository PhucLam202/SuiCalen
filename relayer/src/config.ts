export const RELAYER_CONFIG = {
  scanInterval: 15000, // ms
  maxRetries: 3,
  gasBuffer: 1.2,
  priorityFee: 1000
} as const;

export type RelayerConfig = typeof RELAYER_CONFIG;

