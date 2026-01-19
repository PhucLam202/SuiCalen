/**
 * Scallop SDK Integration Service
 * Fetches APR data from Scallop lending protocol on Sui
 */

import { Scallop } from '@scallop-io/sui-scallop-sdk';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { APRData } from './types';
import { logger } from '../../logger';

interface ScallopServiceConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  addressId?: string;
  secretKey?: number[];
  rpcUrl?: string;
  client?: SuiClient;
}

/**
 * Scallop Service for fetching APR data
 */
export class ScallopService {
  private scallopSDK: Scallop | null = null;
  private network: 'mainnet' | 'testnet' | 'devnet';
  private initialized: boolean = false;

  constructor(config: ScallopServiceConfig) {
    this.network = config.network;
    
    // Scallop SDK only supports mainnet officially
    if (config.network !== 'mainnet') {
      logger.warn(`Scallop SDK only supports mainnet. Network '${config.network}' not supported.`);
      return;
    }

    try {
      // Ensure addressId is a string - Scallop SDK may be checking if it starts with something
      let addressId: string;
      if (config.addressId && typeof config.addressId === 'string' && config.addressId.trim()) {
        addressId = config.addressId.trim();
      } else {
        // Use default mainnet address ID
        addressId = '67c44a103fe1b8c454eb9699';
      }
      
      // Ensure secretKey is an array (optional - only needed for write operations)
      const secretKey: number[] = Array.isArray(config.secretKey) ? config.secretKey : [];
      
      // Build Scallop config - let SDK create its own client internally
      // Passing custom client can interfere with SDK initialization
      const scallopConfig: {
        addressId: string;
        networkType: 'mainnet';
        secretKey?: number[];
        fullNodeUrl?: string;
      } = {
        addressId: addressId,
        networkType: 'mainnet'
      };

      // Add secretKey if provided
      if (secretKey.length > 0) {
        scallopConfig.secretKey = secretKey;
      }

      // Use custom RPC URL if provided (via fullNodeUrl parameter)
      if (config.rpcUrl) {
        scallopConfig.fullNodeUrl = config.rpcUrl;
        logger.info(`Initializing Scallop SDK with addressId: ${addressId}, RPC: ${config.rpcUrl}`);
      } else {
        logger.info(`Initializing Scallop SDK with addressId: ${addressId}`);
      }
      
      this.scallopSDK = new Scallop(scallopConfig);
      // Note: SDK instance created, but needs async init() call before use
      // We'll initialize lazily when getAllScallopAPRs() is called
      logger.info('Scallop SDK instance created (will initialize on first use)');
    } catch (error) {
      logger.error(`Failed to initialize Scallop SDK: ${String(error)}`);
      // Log more details about the error
      if (error instanceof Error) {
        logger.error(`Scallop SDK error message: ${error.message}`);
      }
      this.scallopSDK = null;
      this.initialized = false;
    }
  }

  /**
   * Get APR data for ALL tokens from Scallop
   * On Mainnet, includes both base APR and reward APR for accurate data
   * @returns Array of APR data for all tokens, or empty array if unavailable
   */
  async getAllScallopAPRs(): Promise<APRData[]> {
    if (!this.scallopSDK) return [];
  
    try {
      // createScallopIndexer() handles initialization internally
      // Don't call init() separately - it may not exist or may conflict
      const scallopIndexer = await this.scallopSDK.createScallopIndexer();
      // Indexer lấy dữ liệu từ API của Scallop nên rất nhanh, không lo timeout RPC
      const marketData = await scallopIndexer.getMarket();
      const aprData: APRData[] = [];
  
      if (marketData && marketData.pools) {
        // Indexer thường trả về Object: { sui: {...}, usdc: {...} }
        // Chúng ta dùng Object.entries để lấy cả tên và dữ liệu
        for (const [coinName, pool] of Object.entries(marketData.pools)) {
          const p = pool as Record<string, unknown>;
          
          // Trên Mainnet, dữ liệu thường có cả supplyApr (gốc) và rewardApr (thưởng)
          // Quan trọng cho dự án AMM: cộng cả lãi gốc và lãi thưởng
          const baseApr = (typeof p.supplyApr === 'number' ? p.supplyApr : 0) as number;
          const rewardApr = (typeof p.rewardApr === 'number' ? p.rewardApr : 0) as number;
          
          // Ưu tiên supplyApy nếu có, nếu không thì tính từ baseApr + rewardApr
          const supplyApy = (typeof p.supplyApy === 'number' ? p.supplyApy : null) as number | null;
          const totalApy = supplyApy !== null ? supplyApy : (baseApr + rewardApr);
          
          const tvl = (typeof p.tvl === 'number' ? p.tvl : 0) as number;
  
          aprData.push({
            protocol: 'scallop',
            token: coinName.toUpperCase(),
            // Chuyển đổi sang % (Ví dụ 0.125 -> 12.50)
            apr: Number((totalApy * 100).toFixed(2)),
            tvl: BigInt(Math.floor(tvl)),
            timestamp: new Date()
          });
        }
      }
      
      if (aprData.length > 0) {
        logger.info(`Mainnet Scallop: Retrieved ${aprData.length} APR entries`);
      }
      
      return aprData;
    } catch (error) {
      logger.error(`Mainnet Scallop Error: ${error}`);
      if (error instanceof Error) {
        logger.error(`Mainnet Scallop Error message: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Get APR data for a specific token
   * @param token Token symbol (e.g., 'SUI', 'USDC')
   * @returns APR data for the token, or null if not found
   */
  async getScallopAPR(token: string): Promise<APRData | null> {
    const allAPRs = await this.getAllScallopAPRs();
    const tokenUpper = token.toUpperCase();
    
    return allAPRs.find(apr => apr.token === tokenUpper) || null;
  }
}

/**
 * Create Scallop service instance
 */
export function createScallopService(
  network: 'mainnet' | 'testnet' | 'devnet',
  config?: { addressId?: string; secretKey?: number[]; rpcUrl?: string }
): ScallopService {
  return new ScallopService({
    network,
    ...config
  });
}
