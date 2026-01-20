export const RELAYER_CONFIG = {
  scanInterval: 60000, // ms (1 minute - reduced from 15s for stability)
  maxRetries: 3,
  gasBuffer: 1.2,
  priorityFee: 1000
} as const;

export type RelayerConfig = typeof RELAYER_CONFIG;

export const YIELD_CONFIG = {
  cacheTTL: 60000, // 1 minute
  maxRetries: 3,
  retryDelayMs: 1000,
  protocols: ['scallop', 'navi', 'cetus', 'suilend'] as const
} as const;

export type YieldConfig = typeof YIELD_CONFIG; export const DATABASE_CONFIG = {
  dbName: process.env.MONGODB_DB_NAME || 'calendefi',
  connectionTimeout: 10000, // 10 seconds
  maxRetries: 3,
  retryDelayMs: 1000
} as const;

export type DatabaseConfig = typeof DATABASE_CONFIG;

export const WALRUS_CONFIG = {
  publisherUrl: process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus.gg',
  aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus.gg',
  epochs: process.env.WALRUS_EPOCHS ? parseInt(process.env.WALRUS_EPOCHS, 10) : 1,
  uploadTimeout: 30000, // 30 seconds
  retrievalTimeout: 10000, // 10 seconds
  maxRetries: 3
} as const;

export type WalrusConfig = typeof WALRUS_CONFIG;
