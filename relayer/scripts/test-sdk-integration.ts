/**
 * Test script for SDK Integration & APR Fetcher
 * Tests connections to all protocols and aggregator functionality
 */

import dotenv from 'dotenv';
import { fetchAllAPRs, fetchAPRByToken, createYieldAggregator } from '../src/services/yield/yieldAggregator';
import { logger } from '../src/logger';

dotenv.config();

const NETWORK = (process.env.SUI_NETWORK || 'testnet') as 'mainnet' | 'testnet' | 'devnet';

/**
 * Test individual protocol connections using direct imports
 */
async function testIndividualProtocols(): Promise<void> {
  logger.info('=== Testing Individual Protocols ===');

  try {
    // Test Scallop
    logger.info('\n--- Testing Scallop ---');
    try {
      const { createScallopService } = await import('../src/services/yield/scallopService');
      const scallopService = createScallopService(NETWORK, {
        addressId: process.env.SCALLOP_ADDRESS_ID
      });
      const scallopAPRs = await scallopService.getAllScallopAPRs();
      logger.info(`Scallop: Fetched ${scallopAPRs.length} APR entries`);
      if (scallopAPRs.length > 0) {
        logger.info(`Example: ${JSON.stringify(scallopAPRs[0], null, 2)}`);
      }
    } catch (error) {
      logger.warn(`Scallop test failed: ${String(error)}`);
    }

    // Test Navi
    logger.info('\n--- Testing Navi ---');
    try {
      const { createNaviService } = await import('../src/services/yield/naviService');
      const naviService = createNaviService(NETWORK);
      const naviAPRs = await naviService.getAllNaviAPRs();
      logger.info(`Navi: Fetched ${naviAPRs.length} APR entries`);
      if (naviAPRs.length > 0) {
        logger.info(`Example: ${JSON.stringify(naviAPRs[0], null, 2)}`);
      }
    } catch (error) {
      logger.warn(`Navi test failed: ${String(error)}`);
    }

    // Test Cetus
    logger.info('\n--- Testing Cetus ---');
    try {
      const { createCetusService } = await import('../src/services/yield/cetusService');
      const cetusService = createCetusService(NETWORK);
      const cetusPools = await cetusService.getAllCetusPools();
      logger.info(`Cetus: Fetched ${cetusPools.length} pool entries`);
      if (cetusPools.length > 0) {
        logger.info(`Example: ${JSON.stringify(cetusPools[0], null, 2)}`);
      }
    } catch (error) {
      logger.warn(`Cetus test failed: ${String(error)}`);
    }

    // Test Suilend
    logger.info('\n--- Testing Suilend ---');
    try {
      const { createSuilendService } = await import('../src/services/yield/suilendService');
      const suilendService = createSuilendService(NETWORK, {
        lendingMarketId: process.env.SUILEND_LENDING_MARKET_ID,
        lendingMarketType: process.env.SUILEND_LENDING_MARKET_TYPE
      });
      const suilendAPRs = await suilendService.getAllSuilendAPRs();
      logger.info(`Suilend: Fetched ${suilendAPRs.length} APR entries`);
      if (suilendAPRs.length > 0) {
        logger.info(`Example: ${JSON.stringify(suilendAPRs[0], null, 2)}`);
      }
    } catch (error) {
      logger.warn(`Suilend test failed: ${String(error)}`);
    }
  } catch (error) {
    logger.error(`Individual protocol test error: ${String(error)}`);
  }
}

/**
 * Test aggregator functionality
 */
async function testAggregator(): Promise<void> {
  logger.info('\n=== Testing Aggregator ===');

  try {
    // Test fetchAllAPRs
    logger.info('\n--- Testing fetchAllAPRs() ---');
    const allAPRs = await fetchAllAPRs(NETWORK, {
      scallopConfig: {
        addressId: process.env.SCALLOP_ADDRESS_ID
      },
      suilendConfig: {
        lendingMarketId: process.env.SUILEND_LENDING_MARKET_ID,
        lendingMarketType: process.env.SUILEND_LENDING_MARKET_TYPE
      }
    });

    logger.info(`Total APR entries: ${allAPRs.length}`);
    
    // Group by protocol
    const byProtocol: Record<string, number> = {};
    for (const apr of allAPRs) {
      byProtocol[apr.protocol] = (byProtocol[apr.protocol] || 0) + 1;
    }

    logger.info('APRs by protocol:');
    for (const [protocol, count] of Object.entries(byProtocol)) {
      logger.info(`  ${protocol}: ${count}`);
    }

    // Show top 5 APRs
    if (allAPRs.length > 0) {
      logger.info('\nTop 5 APRs (sorted by APR):');
      const sorted = [...allAPRs].sort((a, b) => b.apr - a.apr).slice(0, 5);
      for (const apr of sorted) {
        logger.info(`  ${apr.protocol} - ${apr.token}: ${apr.apr}% APR, TVL: ${apr.tvl.toString()}`);
      }
    }

    // Test fetchAPRByToken
    logger.info('\n--- Testing fetchAPRByToken("SUI") ---');
    const suiAPRs = await fetchAPRByToken('SUI', NETWORK, {
      scallopConfig: {
        addressId: process.env.SCALLOP_ADDRESS_ID
      },
      suilendConfig: {
        lendingMarketId: process.env.SUILEND_LENDING_MARKET_ID,
        lendingMarketType: process.env.SUILEND_LENDING_MARKET_TYPE
      }
    });

    logger.info(`SUI APR entries: ${suiAPRs.length}`);
    if (suiAPRs.length > 0) {
      logger.info('SUI APRs (sorted by APR):');
      for (const apr of suiAPRs) {
        logger.info(`  ${apr.protocol}: ${apr.apr}% APR, TVL: ${apr.tvl.toString()}`);
      }
    }

    // Test caching
    logger.info('\n--- Testing Cache ---');
    const aggregator = createYieldAggregator({ network: NETWORK });
    logger.info(`Cache size before fetch: ${aggregator.getCacheSize()}`);
    await aggregator.fetchAllAPRs();
    logger.info(`Cache size after fetch: ${aggregator.getCacheSize()}`);

    // Test cache hit
    logger.info('Fetching again (should hit cache)...');
    const cachedStart = Date.now();
    await aggregator.fetchAllAPRs();
    const cachedTime = Date.now() - cachedStart;
    logger.info(`Cache hit time: ${cachedTime}ms`);

  } catch (error) {
    logger.error(`Aggregator test error: ${String(error)}`);
    throw error;
  }
}

/**
 * Main test function
 */
async function main(): Promise<void> {
  logger.info(`\n🧪 Starting SDK Integration Tests on ${NETWORK.toUpperCase()}\n`);

  try {
    // Test individual protocols
    await testIndividualProtocols();

    // Test aggregator
    await testAggregator();

    logger.info('\n✅ All tests completed!');
  } catch (error) {
    logger.error(`\n❌ Test failed: ${String(error)}`);
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  logger.error(`Fatal error: ${String(error)}`);
  process.exit(1);
});
