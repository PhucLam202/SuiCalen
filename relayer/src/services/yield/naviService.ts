/**
 * Navi SDK Integration Service
 * Fetches APR data from Navi lending protocol on Sui
 */

import { getPools } from '@naviprotocol/lending';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { APRData } from './types';
import { logger } from '../../logger';

interface NaviServiceConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  rpcUrl?: string;
  client?: SuiClient;
}

/**
 * Navi Service for fetching APR data
 */
export class NaviService {
  private suiClient: SuiClient;
  private network: 'mainnet' | 'testnet' | 'devnet';
  private initialized: boolean = false;
  private env: 'prod' | 'dev';

  constructor(config: NaviServiceConfig) {
    this.network = config.network;
    const rpcUrl = config.rpcUrl || getFullnodeUrl(config.network);
    this.suiClient = config.client || new SuiClient({ url: rpcUrl });
    this.env = this.network === 'mainnet' ? 'prod' : 'dev';
    this.initialized = true;
    logger.info(`Navi SDK initialized successfully for ${config.network}`);
  }

  /**
   * Get APR data for ALL tokens from Navi
   * @returns Array of APR data for all tokens
   */
  async getAllNaviAPRs(): Promise<APRData[]> {
    if (!this.initialized) {
      logger.error('Navi SDK not initialized');
      return [];
    }

    try {
      // Fetch ALL available pools
      // getPools uses env to determine network (prod/mainnet or dev/testnet)
      logger.debug(`Fetching Navi pools with env: ${this.env}`);
      const pools = await getPools({
        env: this.env
      });

      logger.info(`Navi returned ${pools.length} pools`);
      
      // Debug: log first pool structure (only in debug mode)
      if (pools.length > 0 && process.env.LOG_LEVEL === 'debug') {
        const firstPool = pools[0] as Record<string, unknown>;
        const poolKeys = Object.keys(firstPool);
        logger.debug(`First Navi pool keys: ${poolKeys.join(', ')}`);
      }

      const aprData: APRData[] = [];

      // Extract APR data from all pools
      for (const pool of pools) {
        try {
          const reserveData = pool;
          
          // Extract token information from pool
          const tokenSymbol = this.extractTokenSymbol(reserveData);
          const supplyRate = this.extractSupplyRate(reserveData);
          const totalSupply = this.extractTotalSupply(reserveData);

          // Log fields only in debug mode
          if (process.env.LOG_LEVEL === 'debug' && aprData.length < 3) {
            const poolObj = reserveData as Record<string, unknown>;
            const allFields = Object.keys(poolObj);
            logger.debug(`Pool ${tokenSymbol} - All fields: ${allFields.join(', ')}`);
          }

          logger.debug(`Navi pool: symbol=${tokenSymbol}, rate=${supplyRate}, supply=${totalSupply?.toString()}`);

          if (tokenSymbol && supplyRate !== null && totalSupply !== null) {
            // Convert decimal rate to percentage APR
            const aprPercentage = supplyRate * 100;
            aprData.push({
              protocol: 'navi',
              token: tokenSymbol.toUpperCase(),
              apr: Number(aprPercentage.toFixed(2)),
              tvl: totalSupply,
              timestamp: new Date()
            });
          } else {
            // Only log warning if we have symbol but missing rate/supply
            if (tokenSymbol) {
              logger.debug(`Navi pool missing rate/supply: symbol=${tokenSymbol}, rate=${supplyRate}, supply=${totalSupply?.toString()}`);
            }
          }
        } catch (err) {
          logger.warn(`Failed to parse Navi pool data: ${String(err)}`);
        }
      }

      logger.info(`Fetched ${aprData.length} Navi APR entries from ${pools.length} pools`);
      return aprData;
    } catch (error) {
      logger.error(`Error fetching Navi APR data: ${String(error)}`);
      return [];
    }
  }

  /**
   * Get APR data for a specific token
   * @param token Token symbol (e.g., 'SUI', 'USDC')
   * @returns APR data for the token, or null if not found
   */
  async getNaviAPR(token: string): Promise<APRData | null> {
    const allAPRs = await this.getAllNaviAPRs();
    const tokenUpper = token.toUpperCase();
    
    return allAPRs.find(apr => apr.token === tokenUpper) || null;
  }

  /**
   * Extract token symbol from reserve data
   * @param reserve Reserve data from Navi SDK
   * @returns Token symbol or null
   */
  private extractTokenSymbol(reserve: unknown): string | null {
    if (!reserve || typeof reserve !== 'object') {
      return null;
    }

    const reserveObj = reserve as Record<string, unknown>;
    
    // Navi has a 'token' object with symbol
    if ('token' in reserveObj && typeof reserveObj.token === 'object' && reserveObj.token !== null) {
      const tokenObj = reserveObj.token as Record<string, unknown>;
      if (typeof tokenObj.symbol === 'string') {
        return tokenObj.symbol;
      }
    }
    
    // Try coinType (format: package::module::Type)
    const coinType = reserveObj.coinType;
    if (typeof coinType === 'string') {
      const parts = coinType.split('::');
      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        return lastPart;
      }
    }
    
    // Try direct symbol field
    if (typeof reserveObj.symbol === 'string') {
      return reserveObj.symbol;
    }
    
    if (typeof reserveObj.tokenSymbol === 'string') {
      return reserveObj.tokenSymbol;
    }

    return null;
  }

  /**
   * Extract supply APR rate from reserve data
   * @param reserve Reserve data from Navi SDK
   * @returns Supply rate (0-1) or null
   */
  private extractSupplyRate(reserve: unknown): number | null {
    if (!reserve || typeof reserve !== 'object') {
      return null;
    }

    const reserveObj = reserve as Record<string, unknown>;
    
    // Navi uses currentSupplyRate as a string in "ray" format (1e27 = 100%)
    // Example: "285246575671208398757118" means ~2.85% APR
    if ('currentSupplyRate' in reserveObj) {
      const rateValue = reserveObj.currentSupplyRate;
      
      if (typeof rateValue === 'string') {
        // Convert from ray format (1e27 = 100%) to decimal (0-1)
        // Ray format: 1e27 = 100%, so divide by 1e27 to get decimal
        // Example: "285246575671208398757118" / 1e27 = ~0.000285 = 0.0285%
        try {
          const rayValue = BigInt(rateValue);
          const RAY = BigInt('1000000000000000000000000000'); // 1e27
          // Use division with proper precision
          const decimalRate = Number(rayValue) / Number(RAY);
          return decimalRate;
        } catch (err) {
          logger.warn(`Failed to parse currentSupplyRate: ${rateValue}, error: ${String(err)}`);
          return null;
        }
      }
      
      if (typeof rateValue === 'number') {
        // If already a number, check if it's in ray format (> 1e20) or decimal
        if (rateValue > 1e20) {
          // Ray format, convert to decimal
          return rateValue / 1e27;
        }
        if (rateValue > 1) {
          // Percentage format, convert to decimal
          return rateValue / 100;
        }
        // Already decimal
        return rateValue;
      }
    }

    // Fallback: try other common field names
    const possibleFields = [
      'supplyRate',
      'supplyAPR',
      'currentSupplyAPR',
      'lendingRate',
      'lendingAPR'
    ];

    for (const field of possibleFields) {
      const value = reserveObj[field];
      
      if (typeof value === 'number') {
        if (value > 1e20) {
          return value / 1e27; // Ray format
        }
        if (value > 1) {
          return value / 100; // Percentage
        }
        return value; // Decimal
      }
      
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          if (parsed > 1e20) {
            return parsed / 1e27; // Ray format
          }
          if (parsed > 1) {
            return parsed / 100; // Percentage
          }
          return parsed; // Decimal
        }
      }
    }

    return null;
  }

  /**
   * Extract total supply (TVL) from reserve data
   * @param reserve Reserve data from Navi SDK
   * @returns Total supply or null
   */
  private extractTotalSupply(reserve: unknown): bigint | null {
    if (!reserve || typeof reserve !== 'object') {
      return null;
    }

    const reserveObj = reserve as Record<string, unknown>;
    
    // Navi uses totalSupply as string
    if ('totalSupply' in reserveObj) {
      const supplyValue = reserveObj.totalSupply;
      
      if (typeof supplyValue === 'bigint') {
        return supplyValue;
      }
      if (typeof supplyValue === 'string') {
        try {
          return BigInt(supplyValue);
        } catch {
          return null;
        }
      }
      if (typeof supplyValue === 'number') {
        return BigInt(supplyValue);
      }
    }
    
    // Try totalSupplyAmount as fallback
    if ('totalSupplyAmount' in reserveObj) {
      const supplyValue = reserveObj.totalSupplyAmount;
      if (typeof supplyValue === 'string') {
        try {
          return BigInt(supplyValue);
        } catch {
          return null;
        }
      }
      if (typeof supplyValue === 'number') {
        return BigInt(supplyValue);
      }
    }

    // Fallback: try other common field names
    const possibleFields = ['tvl', 'depositedAmount', 'liquidity', 'totalLiquidity'];
    for (const field of possibleFields) {
      const value = reserveObj[field];
      if (typeof value === 'bigint') {
        return value;
      }
      if (typeof value === 'string') {
        try {
          return BigInt(value);
        } catch {
          continue;
        }
      }
      if (typeof value === 'number') {
        return BigInt(value);
      }
    }

    return null;
  }
}

/**
 * Create Navi service instance
 */
export function createNaviService(
  network: 'mainnet' | 'testnet' | 'devnet',
  config?: { rpcUrl?: string; client?: SuiClient }
): NaviService {
  return new NaviService({
    network,
    ...config
  });
}
