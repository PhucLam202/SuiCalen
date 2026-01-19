/**
 * Type definitions for APR (Annual Percentage Rate) data from DeFi protocols
 */

/**
 * Basic APR information from lending protocols (Scallop, Navi, Suilend)
 */
export interface APRData {
  protocol: 'scallop' | 'navi' | 'suilend';
  token: string; // Token symbol (e.g., 'SUI', 'USDC')
  apr: number; // Annual Percentage Rate (e.g., 8.5 for 8.5%)
  tvl: bigint; // Total Value Locked
  timestamp: Date;
}

/**
 * Pool information from DEX protocols (Cetus)
 */
export interface PoolData {
  protocol: 'cetus';
  poolId: string;
  token0: string; // First token in pair (e.g., 'SUI')
  token1: string; // Second token in pair (e.g., 'USDC')
  apr: number; // Estimated APR from fees
  tvl: bigint; // Total Value Locked (liquidity)
  fee: number; // Pool fee rate (e.g., 0.3 for 0.3%)
  timestamp: Date;
}

/**
 * Swap quote from Cetus
 */
export interface SwapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number; // Percentage (e.g., 0.5 for 0.5%)
  fee: bigint;
}

/**
 * Unified format for all protocols
 */
export interface ProtocolAPR {
  protocol: 'scallop' | 'navi' | 'cetus' | 'suilend';
  token: string; // Token symbol or pair (e.g., 'SUI' or 'SUI/USDC')
  apr: number; // Annual Percentage Rate
  tvl: bigint; // Total Value Locked
  riskScore: number; // 0-10, default 5 for now
  timestamp: Date;
}
