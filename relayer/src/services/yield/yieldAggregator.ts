/**
 * Unified Yield Aggregator Service
 * Aggregates APR data from all protocols (Scallop, Navi, Cetus, Suilend)
 */

import { ProtocolAPR, APRData, PoolData } from './types';
import { ScallopService, createScallopService } from './scallopService';
import { NaviService, createNaviService } from './naviService';
import { CetusService, createCetusService } from './cetusService';
import { SuilendService, createSuilendService } from './suilendService';
import { Cache } from './cache';
import { YIELD_CONFIG } from '../../config';
import { logger } from '../../logger';

interface YieldAggregatorConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  cacheTTL?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  scallopConfig?: { addressId?: string; secretKey?: number[]; rpcUrl?: string };
  naviConfig?: { rpcUrl?: string };
  cetusConfig?: { wallet?: string; fullNodeUrl?: string };
  suilendConfig?: { lendingMarketId?: string; lendingMarketType?: string; rpcUrl?: string };
}

/**
 * Unified Yield Aggregator
 */
export class YieldAggregator {
  private scallopService: ScallopService;
  private naviService: NaviService;
  private cetusService: CetusService;
  private suilendService: SuilendService;
  private cache: Cache<ProtocolAPR[]>;
  private network: 'mainnet' | 'testnet' | 'devnet';
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: YieldAggregatorConfig) {
    this.network = config.network;
    this.maxRetries = config.maxRetries || YIELD_CONFIG.maxRetries;
    this.retryDelayMs = config.retryDelayMs || YIELD_CONFIG.retryDelayMs;
    
    const cacheTTL = config.cacheTTL || YIELD_CONFIG.cacheTTL;
    this.cache = new Cache<ProtocolAPR[]>(cacheTTL);

    // Initialize protocol services
    this.scallopService = createScallopService(this.network, config.scallopConfig);
    this.naviService = createNaviService(this.network, config.naviConfig);
    this.cetusService = createCetusService(this.network, config.cetusConfig);
    this.suilendService = createSuilendService(this.network, config.suilendConfig);

    logger.info(`Yield Aggregator initialized for ${this.network}`);
  }

  /**
   * Fetch APR data from ALL protocols
   * @returns Array of ProtocolAPR for all tokens/pools from all protocols
   */
  async fetchAllAPRs(): Promise<ProtocolAPR[]> {
    // Check cache first
    const cacheKey = `all:${this.network}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      logger.debug('Returning cached APR data');
      return cached;
    }

    const startTime = Date.now();
    logger.info('Fetching APR data from all protocols...');

    // Set timeout for fetching - shorter timeout to return faster
    const FAST_TIMEOUT = 10000; // 10 seconds for fast protocols
    const SLOW_TIMEOUT = 20000; // 20 seconds for slower protocols
    
    // Helper to add timeout to promises
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, protocolName: string): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          logger.warn(`${protocolName} fetch timeout after ${timeoutMs}ms`);
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        promise
          .then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
          })
          .catch((error: unknown) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    };

    // Call all protocol services in parallel with different timeouts
    // Navi and Scallop are usually faster, Cetus and Suilend can be slower
    const results = await Promise.allSettled([
      withTimeout(this.fetchScallopAPRs(), FAST_TIMEOUT, 'Scallop').catch(() => [] as ProtocolAPR[]),
      withTimeout(this.fetchNaviAPRs(), FAST_TIMEOUT, 'Navi').catch(() => [] as ProtocolAPR[]),
      withTimeout(this.fetchCetusPools(), SLOW_TIMEOUT, 'Cetus').catch(() => [] as ProtocolAPR[]),
      withTimeout(this.fetchSuilendAPRs(), SLOW_TIMEOUT, 'Suilend').catch(() => [] as ProtocolAPR[])
    ]);

    const allAPRs: ProtocolAPR[] = [];
    const errors: string[] = [];
    let successCount = 0;

    // Process Scallop results
    if (results[0].status === 'fulfilled' && results[0].value.length > 0) {
      allAPRs.push(...results[0].value);
      successCount++;
      logger.info(`Scallop: ${results[0].value.length} entries`);
    } else if (results[0].status === 'rejected') {
      const error = `Scallop: ${String(results[0].reason)}`;
      errors.push(error);
      logger.warn(error);
    }

    // Process Navi results
    if (results[1].status === 'fulfilled' && results[1].value.length > 0) {
      allAPRs.push(...results[1].value);
      successCount++;
      logger.info(`Navi: ${results[1].value.length} entries`);
    } else if (results[1].status === 'rejected') {
      const error = `Navi: ${String(results[1].reason)}`;
      errors.push(error);
      logger.warn(error);
    }

    // Process Cetus results
    if (results[2].status === 'fulfilled' && results[2].value.length > 0) {
      allAPRs.push(...results[2].value);
      successCount++;
      logger.info(`Cetus: ${results[2].value.length} entries`);
    } else if (results[2].status === 'rejected') {
      const error = `Cetus: ${String(results[2].reason)}`;
      errors.push(error);
      logger.warn(error);
    }

    // Process Suilend results
    if (results[3].status === 'fulfilled' && results[3].value.length > 0) {
      allAPRs.push(...results[3].value);
      successCount++;
      logger.info(`Suilend: ${results[3].value.length} entries`);
    } else if (results[3].status === 'rejected') {
      const error = `Suilend: ${String(results[3].reason)}`;
      errors.push(error);
      logger.warn(error);
    }

    if (errors.length > 0) {
      logger.warn(`${errors.length} protocol(s) failed/timed out: ${errors.join('; ')}`);
    }

    // Return results even if only one protocol succeeded
    if (successCount > 0) {
      logger.info(`Successfully fetched from ${successCount} protocol(s) with ${allAPRs.length} total entries`);
    } else {
      logger.warn('No protocols returned data');
    }

    const duration = Date.now() - startTime;
    logger.info(`Fetched ${allAPRs.length} total APR entries from ${allAPRs.length > 0 ? 'active' : 'no'} protocols in ${duration}ms`);

    // Cache results
    this.cache.set(cacheKey, allAPRs);

    return allAPRs;
  }

  /**
   * Fetch APR data filtered by token
   * @param token Token symbol (e.g., 'SUI', 'USDC')
   * @returns Array of ProtocolAPR for the token, sorted by APR (highest first)
   */
  async fetchAPRByToken(token: string): Promise<ProtocolAPR[]> {
    // Check cache first
    const cacheKey = `token:${token.toUpperCase()}:${this.network}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      logger.debug(`Returning cached APR data for ${token}`);
      return cached;
    }

    // Fetch all APRs and filter by token
    const allAPRs = await this.fetchAllAPRs();
    const tokenUpper = token.toUpperCase();
    
    // Filter by token (support both single token and pair formats)
    const filtered = allAPRs.filter(apr => {
      const aprToken = apr.token.toUpperCase();
      return aprToken === tokenUpper || 
             aprToken.startsWith(`${tokenUpper}/`) || 
             aprToken.endsWith(`/${tokenUpper}`);
    });

    // Sort by APR (highest first)
    filtered.sort((a, b) => b.apr - a.apr);

    logger.info(`Found ${filtered.length} APR entries for ${token}`);

    // Cache results
    this.cache.set(cacheKey, filtered);

    return filtered;
  }

  /**
   * Fetch APR data from Scallop with retry logic
   */
  private async fetchScallopAPRs(): Promise<ProtocolAPR[]> {
    return this.retryWithBackoff(async () => {
      const aprData = await this.scallopService.getAllScallopAPRs();
      return this.convertToProtocolAPR(aprData, 'scallop');
    });
  }

  /**
   * Fetch APR data from Navi with retry logic
   */
  private async fetchNaviAPRs(): Promise<ProtocolAPR[]> {
    return this.retryWithBackoff(async () => {
      const startTime = Date.now();
      const aprData = await this.naviService.getAllNaviAPRs();
      const duration = Date.now() - startTime;
      logger.info(`Navi fetch completed in ${duration}ms, got ${aprData.length} entries`);
      return this.convertToProtocolAPR(aprData, 'navi');
    });
  }

  /**
   * Fetch pool data from Cetus with retry logic
   */
  private async fetchCetusPools(): Promise<ProtocolAPR[]> {
    return this.retryWithBackoff(async () => {
      const startTime = Date.now();
      const poolData = await this.cetusService.getAllCetusPools();
      const duration = Date.now() - startTime;
      logger.info(`Cetus fetch completed in ${duration}ms, got ${poolData.length} entries`);
      return this.convertPoolDataToProtocolAPR(poolData);
    });
  }

  /**
   * Fetch APR data from Suilend with retry logic
   */
  private async fetchSuilendAPRs(): Promise<ProtocolAPR[]> {
    return this.retryWithBackoff(async () => {
      const aprData = await this.suilendService.getAllSuilendAPRs();
      return this.convertToProtocolAPR(aprData, 'suilend');
    });
  }

  /**
   * Convert APRData to ProtocolAPR format
   */
  private convertToProtocolAPR(aprData: APRData[], protocol: 'scallop' | 'navi' | 'suilend'): ProtocolAPR[] {
    return aprData.map(data => ({
      protocol,
      token: data.token,
      apr: data.apr,
      tvl: data.tvl,
      riskScore: 5, // Default risk score
      timestamp: data.timestamp
    }));
  }

  /**
   * Convert PoolData to ProtocolAPR format
   */
  private convertPoolDataToProtocolAPR(poolData: PoolData[]): ProtocolAPR[] {
    return poolData.map(data => ({
      protocol: 'cetus',
      token: `${data.token0}/${data.token1}`, // Format as token pair
      apr: data.apr,
      tvl: data.tvl,
      riskScore: 5, // Default risk score
      timestamp: data.timestamp
    }));
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | unknown = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors (e.g., testnet not supported)
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error is non-retryable (e.g., testnet not supported)
   */
  private isNonRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const errorMessage = String(error).toLowerCase();
    return errorMessage.includes('testnet not supported') ||
           errorMessage.includes('mainnet only') ||
           errorMessage.includes('not initialized');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size();
  }
}

/**
 * Create Yield Aggregator instance
 */
export function createYieldAggregator(config: YieldAggregatorConfig): YieldAggregator {
  return new YieldAggregator(config);
}

// Export convenience function
export async function fetchAllAPRs(
  network: 'mainnet' | 'testnet' | 'devnet' = 'testnet',
  config?: Omit<YieldAggregatorConfig, 'network'>
): Promise<ProtocolAPR[]> {
  const aggregator = createYieldAggregator({ network, ...config });
  return aggregator.fetchAllAPRs();
}

export async function fetchAPRByToken(
  token: string,
  network: 'mainnet' | 'testnet' | 'devnet' = 'testnet',
  config?: Omit<YieldAggregatorConfig, 'network'>
): Promise<ProtocolAPR[]> {
  const aggregator = createYieldAggregator({ network, ...config });
  return aggregator.fetchAPRByToken(token);
}
