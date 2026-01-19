/**
 * Cetus SDK Integration Service
 * Fetches APR data from Cetus DEX (CLMM) on Sui
 */

import { initCetusSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { PoolData, SwapQuote } from './types';
import { logger } from '../../logger';

interface CetusServiceConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  wallet?: string;
  fullNodeUrl?: string;
}

/**
 * Cetus Service for fetching pool data and APR
 */
export class CetusService {
  private sdk: ReturnType<typeof initCetusSDK> | null = null;
  private network: 'mainnet' | 'testnet' | 'devnet';
  private initialized: boolean = false;

  constructor(config: CetusServiceConfig) {
    this.network = config.network;
    const fullNodeUrl = config.fullNodeUrl || getFullnodeUrl(config.network);

    try {
      this.sdk = initCetusSDK({
        network: config.network,
        wallet: config.wallet,
        fullNodeUrl
      });
      this.initialized = true;
      logger.info(`Cetus SDK initialized successfully for ${config.network}`);
    } catch (error) {
      logger.error(`Failed to initialize Cetus SDK: ${String(error)}`);
      this.sdk = null;
    }
  }

  /**
   * Get pool data for ALL pools from Cetus
   * @returns Array of pool data for all pools
   */
  // async getAllCetusPools(): Promise<PoolData[]> {
  //   if (!this.initialized || !this.sdk) return [];
  
  //   try {
  //     // Để lấy APR chính xác, ta nên fetch từ danh sách pool có thông số thống kê
  //     const pools = await this.sdk.Pool.getPoolsWithPage([]);
  //     const poolData: PoolData[] = [];
  
  //     for (const pool of pools) {
  //       // Cetus trả về pool.apr_24h hoặc pool.apr_7d (dạng string hoặc number)
  //       // Nếu không có, ta mặc định là 0 thay vì tự tính toán sai lệch
  //       const rawApr = (pool as any).apr_24h || (pool as any).apr_7d || 0;
        
  //       poolData.push({
  //         protocol: 'cetus',
  //         poolId: pool.poolAddress,
  //         token0: this.extractTokenSymbol(pool.coinTypeA),
  //         token1: this.extractTokenSymbol(pool.coinTypeB),
  //         apr: Number((parseFloat(rawApr) * 100).toFixed(2)),
  //         tvl: BigInt(Math.floor(parseFloat(pool.tvl || '0'))),
  //         fee: parseFloat(pool.fee || '0'),
  //         timestamp: new Date()
  //       });
  //     }
  //     return poolData;
  //   } catch (error) {
  //     logger.error(`Cetus Error: ${error}`);
  //     return [];
  //   }
  // }
  async getAllCetusPools(): Promise<PoolData[]> {
    if (this.network === 'testnet') {
      // Trên testnet, nên tạo 1 danh sách pool ID cố định thay vì scan
      const testnetPools = ['0xPoolID_1', '0xPoolID_2']; 
      const poolData = [];
      
      for (const id of testnetPools) {
         const pool = await this.sdk.Pool.getPool(id);
         // Xử lý dữ liệu thô từ pool object
      }
      return poolData;
    }
  }
  /**
   * Get pool data for a specific pool ID
   * @param poolId Pool ID
   * @returns Pool data or null if not found
   */
  async getCetusPoolData(poolId: string): Promise<PoolData | null> {
    if (!this.initialized || !this.sdk) {
      logger.error('Cetus SDK not initialized');
      return null;
    }

    try {
      // Try to get pool by ID - implementation depends on SDK
      // If SDK doesn't support get by ID, fetch all and filter
      const allPools = await this.getAllCetusPools();
      return allPools.find(pool => pool.poolId === poolId) || null;
    } catch (error) {
      logger.error(`Error fetching Cetus pool data for ${poolId}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Get swap quote from Cetus
   * @param tokenIn Input token address/type
   * @param tokenOut Output token address/type
   * @param amount Input amount
   * @returns Swap quote or null if unavailable
   */
  async getSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amount: bigint
  ): Promise<SwapQuote | null> {
    if (!this.initialized || !this.sdk) {
      logger.error('Cetus SDK not initialized');
      return null;
    }

    try {
      // Use SDK swap quote methods
      // The exact method depends on the SDK version
      // This is a placeholder that needs to be implemented based on actual SDK API
      const quote = await this.sdk.Router.getBestRoute({
        coinTypeA: tokenIn,
        coinTypeB: tokenOut,
        amount: amount.toString(),
        byAmountIn: true
      });

      if (!quote) {
        return null;
      }

      // Extract quote data
      const amountOut = BigInt(quote.estimateAmountOut || '0');
      const fee = BigInt(quote.feeAmount || '0');
      
      // Calculate price impact (simplified)
      const priceImpact = quote.priceImpact || 0;

      return {
        tokenIn,
        tokenOut,
        amountIn: amount,
        amountOut,
        priceImpact: typeof priceImpact === 'number' ? priceImpact : 0,
        fee
      };
    } catch (error) {
      logger.error(`Error getting Cetus swap quote: ${String(error)}`);
      return null;
    }
  }

  /**
   * Extract pool information from Cetus pool data
   * @param pool Pool data from SDK
   * @returns Pool data or null
   */
  private async extractPoolInfo(pool: unknown): Promise<PoolData | null> {
    if (!pool || typeof pool !== 'object') {
      return null;
    }

    const poolObj = pool as Record<string, unknown>;
    
    try {
      // Extract pool ID
      const poolId = typeof poolObj.poolAddress === 'string' 
        ? poolObj.poolAddress 
        : typeof poolObj.id === 'string' 
        ? poolObj.id 
        : null;

      if (!poolId) {
        return null;
      }

      // Extract token pair
      const token0 = this.extractTokenFromPool(poolObj, 0);
      const token1 = this.extractTokenFromPool(poolObj, 1);

      if (!token0 || !token1) {
        return null;
      }

      // Extract liquidity (TVL)
      const tvl = this.extractLiquidity(poolObj);

      // Extract fee rate
      const feeRate = this.extractFeeRate(poolObj);

      // Calculate estimated APR from fees
      // This is a simplified calculation - in production, you'd need historical volume data
      const apr = this.estimateAPRFromFee(poolObj, feeRate);

      return {
        protocol: 'cetus',
        poolId,
        token0: token0.toUpperCase(),
        token1: token1.toUpperCase(),
        apr: Number(apr.toFixed(2)),
        tvl,
        fee: feeRate,
        timestamp: new Date()
      };
    } catch (error) {
      logger.warn(`Failed to extract pool info: ${String(error)}`);
      return null;
    }
  }

  /**
   * Extract token from pool data
   */
  private extractTokenFromPool(pool: Record<string, unknown>, index: number): string | null {
    // Try common field names
    if (index === 0) {
      if (typeof pool.coinTypeA === 'string') {
        return this.extractTokenSymbol(pool.coinTypeA);
      }
      if (typeof pool.tokenA === 'string') {
        return pool.tokenA;
      }
    } else {
      if (typeof pool.coinTypeB === 'string') {
        return this.extractTokenSymbol(pool.coinTypeB);
      }
      if (typeof pool.tokenB === 'string') {
        return pool.tokenB;
      }
    }

    return null;
  }

  /**
   * Extract token symbol from coin type
   */
  private extractTokenSymbol(coinType: string): string {
    const parts = coinType.split('::');
    return parts[parts.length - 1] || coinType;
  }

  /**
   * Extract liquidity (TVL) from pool data
   */
  private extractLiquidity(pool: Record<string, unknown>): bigint {
    if (typeof pool.liquidity === 'bigint') {
      return pool.liquidity;
    }
    if (typeof pool.liquidity === 'string') {
      try {
        return BigInt(pool.liquidity);
      } catch {
        return BigInt(0);
      }
    }
    if (typeof pool.tvl === 'bigint') {
      return pool.tvl;
    }
    if (typeof pool.tvl === 'string') {
      try {
        return BigInt(pool.tvl);
      } catch {
        return BigInt(0);
      }
    }
    return BigInt(0);
  }

  /**
   * Extract fee rate from pool data
   */
  private extractFeeRate(pool: Record<string, unknown>): number {
    if (typeof pool.feeRate === 'number') {
      return pool.feeRate;
    }
    if (typeof pool.feeRate === 'string') {
      return parseFloat(pool.feeRate);
    }
    if (typeof pool.fee === 'number') {
      return pool.fee;
    }
    // Default fee rate for Cetus pools
    return 0.3; // 0.3%
  }

  /**
   * Estimate APR from fee rate and pool data
   * This is a simplified calculation - real APR depends on trading volume
   */
  private estimateAPRFromFee(pool: Record<string, unknown>, feeRate: number): number {
    // This is a placeholder calculation
    // Real implementation would need:
    // - Historical trading volume
    // - Current liquidity
    // - Fee rate
    
    // Simplified: assume 100% of TVL trades annually with fee rate
    // This is NOT accurate, just an estimate
    const liquidity = this.extractLiquidity(pool);
    if (liquidity === BigInt(0)) {
      return 0;
    }

    // Very rough estimate: (fee_rate * volume_estimate) / liquidity * 100
    // For now, return a basic estimate based on fee rate
    // In production, you'd query historical data or use an API
    return feeRate * 2; // Placeholder: assume 2x fee rate as APR estimate
  }
}

/**
 * Create Cetus service instance
 */
export function createCetusService(
  network: 'mainnet' | 'testnet' | 'devnet',
  config?: { wallet?: string; fullNodeUrl?: string }
): CetusService {
  return new CetusService({
    network,
    ...config
  });
}
