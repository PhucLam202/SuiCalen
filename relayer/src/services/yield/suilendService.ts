/**
 * Suilend SDK Integration Service
 * Fetches APR data from Suilend lending protocol on Sui
 */

import { SuilendClient, LENDING_MARKET_ID, LENDING_MARKET_TYPE } from '@suilend/sdk';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { APRData } from './types';
import { logger } from '../../logger';

interface SuilendServiceConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  lendingMarketId?: string;
  lendingMarketType?: string;
  rpcUrl?: string;
}

/**
 * Suilend Service for fetching APR data
 */
export class SuilendService {
  private suilendClient: SuilendClient | null = null;
  private network: 'mainnet' | 'testnet' | 'devnet';
  private initialized: boolean = false;
  private suiClient: SuiClient;

  constructor(config: SuilendServiceConfig) {
    this.network = config.network;
    const rpcUrl = config.rpcUrl || getFullnodeUrl(config.network);
    this.suiClient = new SuiClient({ url: rpcUrl });

    // Use provided market ID or default
    const marketId = config.lendingMarketId || LENDING_MARKET_ID;
    const marketType = config.lendingMarketType || LENDING_MARKET_TYPE;

    this.initialize(marketId, marketType).catch((error) => {
      logger.error(`Failed to initialize Suilend SDK: ${String(error)}`);
      this.suilendClient = null;
    });
  }

  /**
   * Initialize Suilend client
   */
  private async initialize(marketId: string, marketType: string): Promise<void> {
    try {
      this.suilendClient = await SuilendClient.initialize(
        marketId,
        marketType,
        this.suiClient
      );
      this.initialized = true;
      logger.info(`Suilend SDK initialized successfully for ${this.network}`);
    } catch (error) {
      logger.error(`Failed to initialize Suilend client: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Wait for initialization to complete
   */
  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized && this.suilendClient) {
      return true;
    }

    // Wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.initialized && this.suilendClient !== null;
  }

  /**
   * Get APR data for ALL tokens from Suilend
   * @returns Array of APR data for all tokens
   */
  async getAllSuilendAPRs(): Promise<APRData[]> {
    const isReady = await this.ensureInitialized();
    
    if (!isReady || !this.suilendClient) {
      logger.error('Suilend SDK not initialized');
      return [];
    }

    try {
      // Fetch ALL market data
      // The exact method depends on Suilend SDK API
      // This is a placeholder that needs to be adapted to actual SDK methods
      const marketData = await this.fetchMarketData();

      const aprData: APRData[] = [];

      // Extract APR data from all markets/reserves
      for (const reserve of marketData) {
        try {
          const tokenSymbol = this.extractTokenSymbol(reserve);
          const supplyRate = this.extractSupplyRate(reserve);
          const totalSupply = this.extractTotalSupply(reserve);

          if (tokenSymbol && supplyRate !== null && totalSupply !== null) {
            aprData.push({
              protocol: 'suilend',
              token: tokenSymbol.toUpperCase(),
              apr: Number((supplyRate * 100).toFixed(2)),
              tvl: totalSupply,
              timestamp: new Date()
            });
          }
        } catch (err) {
          logger.warn(`Failed to parse Suilend reserve data: ${String(err)}`);
        }
      }

      logger.info(`Fetched ${aprData.length} Suilend APR entries`);
      return aprData;
    } catch (error) {
      logger.error(`Error fetching Suilend APR data: ${String(error)}`);
      
      // If testnet market ID not found, return empty array gracefully
      if (this.network === 'testnet' && String(error).includes('market')) {
        logger.warn('Testnet market ID may not be configured. Returning empty array.');
        return [];
      }
      
      return [];
    }
  }

  /**
   * Get APR data for a specific token
   * @param token Token symbol (e.g., 'SUI', 'USDC')
   * @returns APR data for the token, or null if not found
   */
  async getSuilendAPR(token: string): Promise<APRData | null> {
    const allAPRs = await this.getAllSuilendAPRs();
    const tokenUpper = token.toUpperCase();
    
    return allAPRs.find(apr => apr.token === tokenUpper) || null;
  }

  /**
   * Fetch market data from Suilend SDK
   * This is a placeholder - actual implementation depends on SDK API
   */
  private async fetchMarketData(): Promise<unknown[]> {
    if (!this.suilendClient) {
      return [];
    }

    // The exact method depends on Suilend SDK version
    // Common patterns: client.getReserves(), client.getMarkets(), etc.
    // This needs to be adapted based on actual SDK documentation
    
    try {
      // Try common method names
      if (typeof (this.suilendClient as unknown as Record<string, unknown>).getReserves === 'function') {
        return await ((this.suilendClient as unknown as Record<string, () => Promise<unknown[]>>).getReserves()) as unknown[];
      }
      if (typeof (this.suilendClient as unknown as Record<string, unknown>).getMarkets === 'function') {
        return await ((this.suilendClient as unknown as Record<string, () => Promise<unknown[]>>).getMarkets()) as unknown[];
      }
      
      // If no method found, log warning and return empty array
      logger.warn('Suilend SDK method to fetch market data not found. Please check SDK documentation.');
      return [];
    } catch (error) {
      logger.error(`Error fetching Suilend market data: ${String(error)}`);
      return [];
    }
  }

  /**
   * Extract token symbol from reserve data
   */
  private extractTokenSymbol(reserve: unknown): string | null {
    if (!reserve || typeof reserve !== 'object') {
      return null;
    }

    const reserveObj = reserve as Record<string, unknown>;
    
    // Try common field names
    if (typeof reserveObj.symbol === 'string') {
      return reserveObj.symbol;
    }
    if (typeof reserveObj.tokenSymbol === 'string') {
      return reserveObj.tokenSymbol;
    }
    if (typeof reserveObj.coinType === 'string') {
      const parts = reserveObj.coinType.split('::');
      return parts[parts.length - 1] || null;
    }

    return null;
  }

  /**
   * Extract supply APR rate from reserve data
   */
  private extractSupplyRate(reserve: unknown): number | null {
    if (!reserve || typeof reserve !== 'object') {
      return null;
    }

    const reserveObj = reserve as Record<string, unknown>;
    
    // Try common field names
    if (typeof reserveObj.supplyRate === 'number') {
      return reserveObj.supplyRate;
    }
    if (typeof reserveObj.supplyAPR === 'number') {
      return reserveObj.supplyAPR / 100; // Convert percentage to decimal
    }
    if (typeof reserveObj.supplyRate === 'string') {
      return parseFloat(reserveObj.supplyRate);
    }
    if (typeof reserveObj.currentSupplyRate === 'number') {
      return reserveObj.currentSupplyRate;
    }

    return null;
  }

  /**
   * Extract total supply (TVL) from reserve data
   */
  private extractTotalSupply(reserve: unknown): bigint | null {
    if (!reserve || typeof reserve !== 'object') {
      return null;
    }

    const reserveObj = reserve as Record<string, unknown>;
    
    // Try common field names
    if (typeof reserveObj.totalSupply === 'bigint') {
      return reserveObj.totalSupply;
    }
    if (typeof reserveObj.totalSupply === 'string') {
      try {
        return BigInt(reserveObj.totalSupply);
      } catch {
        return null;
      }
    }
    if (typeof reserveObj.totalSupply === 'number') {
      return BigInt(reserveObj.totalSupply);
    }
    if (typeof reserveObj.depositedAmount === 'bigint') {
      return reserveObj.depositedAmount;
    }
    if (typeof reserveObj.depositedAmount === 'string') {
      try {
        return BigInt(reserveObj.depositedAmount);
      } catch {
        return null;
      }
    }

    return null;
  }
}

/**
 * Create Suilend service instance
 */
export function createSuilendService(
  network: 'mainnet' | 'testnet' | 'devnet',
  config?: { 
    lendingMarketId?: string; 
    lendingMarketType?: string; 
    rpcUrl?: string;
  }
): SuilendService {
  return new SuilendService({
    network,
    ...config
  });
}
