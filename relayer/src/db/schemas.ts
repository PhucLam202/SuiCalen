/**
 * MongoDB Collection Schemas and Type Definitions
 * Document schema definitions for yield_strategies and apr_snapshots collections
 */

import type { StoredSwapConfig, StoredYieldPositionRef } from '../services/execution/types';

/**
 * Yield Strategy Document Schema
 * Stores user investment strategies linked to autopay tasks
 */
export interface YieldStrategyDocument {
  _id?: string; // MongoDB ObjectId (optional on input, always present on output)
  userAddress: string;
  taskId: string; // Unique - links to autopay task_id
  amount: string; // BigInt serialized as string
  targetDate: Date;
  targetAddress: string;
  /**
   * Optional token metadata used for execution (Phase 10.4).
   * These fields are optional for backward compatibility with older documents.
   */
  token?: string | null;
  coinType?: string | null;
  targetToken?: string | null;
  targetCoinType?: string | null;
  currentProtocol: string | null; // Protocol currently holding funds
  selectedProtocol: string; // Protocol selected by AI
  aprAtSelection: number; // APR at time of selection
  walrusSnapshotId: string | null; // Reference to Walrus snapshot
  /**
   * Optional execution references (protocol-specific) required to withdraw.
   */
  positionRef?: StoredYieldPositionRef | null;
  /**
   * Optional swap configuration for atomic execution.
   */
  swapConfig?: StoredSwapConfig | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input type for creating a yield strategy (without _id, createdAt, updatedAt)
 */
export interface YieldStrategyInput {
  userAddress: string;
  taskId: string;
  amount: bigint; // Will be converted to string for storage
  targetDate: Date;
  targetAddress: string;
  token?: string | null;
  coinType?: string | null;
  targetToken?: string | null;
  targetCoinType?: string | null;
  currentProtocol?: string | null;
  selectedProtocol: string;
  aprAtSelection: number;
  walrusSnapshotId?: string | null;
  positionRef?: StoredYieldPositionRef | null;
  swapConfig?: StoredSwapConfig | null;
}

/**
 * APR Snapshot Document Schema
 * Historical APR data from all protocols
 */
export interface APRSnapshotDocument {
  _id?: string; // MongoDB ObjectId (optional on input, always present on output)
  protocol: 'scallop' | 'navi' | 'cetus' | 'suilend';
  token: string; // Token symbol (e.g., 'SUI', 'USDC')
  apr: number; // Annual Percentage Rate (e.g., 8.5 for 8.5%)
  tvl: string; // BigInt serialized as string
  riskScore: number; // 0-10 scale, default 5.0
  timestamp: Date;
}

/**
 * Input type for creating an APR snapshot (without _id)
 */
export interface APRSnapshotInput {
  protocol: 'scallop' | 'navi' | 'cetus' | 'suilend';
  token: string;
  apr: number;
  tvl: bigint; // Will be converted to string for storage
  riskScore?: number; // Optional, defaults to 5.0
}

/**
 * Collection names
 */
export const COLLECTIONS = {
  YIELD_STRATEGIES: 'yield_strategies',
  APR_SNAPSHOTS: 'apr_snapshots'
} as const;

/**
 * Index definitions for reference
 * These will be created in mongoClient.ts or a migration script
 */
export const INDEXES = {
  YIELD_STRATEGIES: {
    USER_ADDRESS: { userAddress: 1 },
    TASK_ID_UNIQUE: { taskId: 1 }, // Unique index
    CREATED_AT: { createdAt: -1 }
  },
  APR_SNAPSHOTS: {
    PROTOCOL_TOKEN: { protocol: 1, token: 1 }, // Compound index
    TIMESTAMP: { timestamp: -1 }
  }
} as const;
