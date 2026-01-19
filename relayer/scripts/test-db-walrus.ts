/**
 * Test script for Database & Walrus Integration
 * Validates all database and Walrus operations
 */

import 'dotenv/config';
import { connectMongoDB, testConnection, closeMongoDB } from '../src/db/mongoClient';
import {
  createYieldStrategy,
  getYieldStrategyByTaskId,
  getYieldStrategiesByUser,
  updateYieldStrategy,
  deleteYieldStrategy
} from '../src/services/db/yieldStrategyService';
import {
  saveAPRSnapshot,
  saveAPRSnapshots,
  getHistoricalAPR,
  getLatestAPR,
  getAPRHistory
} from '../src/services/db/aprSnapshotService';
import { testWalrusConnection, uploadToWalrus, getFromWalrus } from '../src/services/walrus/walrusClient';
import {
  saveInvestmentDecision,
  getInvestmentDecision,
  InvestmentDecision
} from '../src/services/walrus/investmentJournal';
import { snapshotAPRData, snapshotInvestmentDecision } from '../src/services/snapshot/snapshotOrchestrator';
import { ProtocolAPR } from '../src/services/yield/types';
import { logger } from '../src/logger';

/**
 * Test MongoDB connection
 */
async function testMongoConnection(): Promise<boolean> {
  logger.info('\n=== Testing MongoDB Connection ===');
  try {
    const success = await testConnection();
    if (success) {
      logger.info('✅ MongoDB connection: SUCCESS');
      return true;
    } else {
      logger.error('❌ MongoDB connection: FAILED');
      return false;
    }
  } catch (error) {
    logger.error(`❌ MongoDB connection: FAILED - ${String(error)}`);
    return false;
  }
}

/**
 * Test Yield Strategy CRUD operations
 */
async function testYieldStrategyService(): Promise<boolean> {
  logger.info('\n=== Testing Yield Strategy Service ===');
  
  try {
    const testTaskId = `test-task-${Date.now()}`;
    const testUserAddress = '0x1234567890abcdef';
    
    // Create
    logger.info('Testing createYieldStrategy...');
    const created = await createYieldStrategy({
      userAddress: testUserAddress,
      taskId: testTaskId,
      amount: BigInt('1000000000000'), // 1 SUI in MIST
      targetDate: new Date('2026-12-31'),
      targetAddress: '0xtarget123',
      selectedProtocol: 'scallop',
      aprAtSelection: 8.5
    });
    logger.info(`✅ Created yield strategy: ${created._id}`);
    
    // Read by taskId
    logger.info('Testing getYieldStrategyByTaskId...');
    const found = await getYieldStrategyByTaskId(testTaskId);
    if (!found || found.taskId !== testTaskId) {
      throw new Error('Failed to retrieve yield strategy by taskId');
    }
    logger.info(`✅ Retrieved yield strategy: ${found._id}`);
    
    // Read by user
    logger.info('Testing getYieldStrategiesByUser...');
    const userStrategies = await getYieldStrategiesByUser(testUserAddress);
    if (userStrategies.length === 0) {
      throw new Error('Failed to retrieve yield strategies by user');
    }
    logger.info(`✅ Retrieved ${userStrategies.length} yield strategies for user`);
    
    // Update
    logger.info('Testing updateYieldStrategy...');
    if (!created._id) {
      throw new Error('Created strategy missing _id');
    }
    await updateYieldStrategy(created._id, {
      currentProtocol: 'navi',
      walrusSnapshotId: 'test-blob-id'
    });
    logger.info(`✅ Updated yield strategy: ${created._id}`);
    
    // Cleanup - Delete
    logger.info('Testing deleteYieldStrategy...');
    await deleteYieldStrategy(created._id);
    logger.info(`✅ Deleted yield strategy: ${created._id}`);
    
    logger.info('✅ Yield Strategy Service: ALL TESTS PASSED');
    return true;
    
  } catch (error) {
    logger.error(`❌ Yield Strategy Service: FAILED - ${String(error)}`);
    return false;
  }
}

/**
 * Test APR Snapshot Service
 */
async function testAPRSnapshotService(): Promise<boolean> {
  logger.info('\n=== Testing APR Snapshot Service ===');
  
  try {
    // Save single snapshot
    logger.info('Testing saveAPRSnapshot...');
    const snapshot = await saveAPRSnapshot({
      protocol: 'scallop',
      token: 'SUI',
      apr: 8.5,
      tvl: BigInt('1000000000000000'), // 1000 SUI
      riskScore: 5.0
    });
    logger.info(`✅ Saved APR snapshot: ${snapshot._id}`);
    
    // Save batch snapshots
    logger.info('Testing saveAPRSnapshots (batch)...');
    const batch = await saveAPRSnapshots([
      { protocol: 'navi', token: 'USDC', apr: 6.2, tvl: BigInt('50000000000'), riskScore: 4.5 },
      { protocol: 'cetus', token: 'SUI/USDC', apr: 12.3, tvl: BigInt('2000000000000000'), riskScore: 6.0 }
    ]);
    logger.info(`✅ Saved ${batch.length} APR snapshots in batch`);
    
    // Get latest APR
    logger.info('Testing getLatestAPR...');
    const latest = await getLatestAPR('scallop', 'SUI');
    if (!latest) {
      throw new Error('Failed to retrieve latest APR');
    }
    logger.info(`✅ Retrieved latest APR: ${latest.apr}%`);
    
    // Get historical APR
    logger.info('Testing getHistoricalAPR...');
    const historical = await getHistoricalAPR('scallop', 'SUI', 24); // Last 24 hours
    logger.info(`✅ Retrieved ${historical.length} historical APR entries`);
    
    // Get APR history
    logger.info('Testing getAPRHistory...');
    const history = await getAPRHistory('scallop', 'SUI', 10);
    logger.info(`✅ Retrieved ${history.length} APR history entries`);
    
    logger.info('✅ APR Snapshot Service: ALL TESTS PASSED');
    return true;
    
  } catch (error) {
    logger.error(`❌ APR Snapshot Service: FAILED - ${String(error)}`);
    return false;
  }
}

/**
 * Test Walrus client
 */
async function testWalrusClient(): Promise<boolean> {
  logger.info('\n=== Testing Walrus Client ===');
  
  try {
    // Test connection
    logger.info('Testing testWalrusConnection...');
    const connectionTest = await testWalrusConnection();
    if (!connectionTest) {
      logger.warn('⚠️  Walrus connection test failed - this may be expected if Walrus is not configured');
      return false;
    }
    logger.info('✅ Walrus connection: SUCCESS');
    
    // Test upload
    logger.info('Testing uploadToWalrus...');
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      data: 'Test data for Walrus'
    };
    const blobId = await uploadToWalrus(testData);
    if (!blobId) {
      throw new Error('Failed to upload to Walrus');
    }
    logger.info(`✅ Uploaded to Walrus: ${blobId}`);
    
    // Test retrieval
    logger.info('Testing getFromWalrus...');
    const retrieved = await getFromWalrus(blobId);
    if (!retrieved) {
      throw new Error('Failed to retrieve from Walrus');
    }
    logger.info(`✅ Retrieved from Walrus: ${blobId}`);
    
    logger.info('✅ Walrus Client: ALL TESTS PASSED');
    return true;
    
  } catch (error) {
    logger.error(`❌ Walrus Client: FAILED - ${String(error)}`);
    return false;
  }
}

/**
 * Test Investment Journal Service
 */
async function testInvestmentJournal(): Promise<boolean> {
  logger.info('\n=== Testing Investment Journal Service ===');
  
  try {
    const testProtocols: ProtocolAPR[] = [
      {
        protocol: 'scallop',
        token: 'SUI',
        apr: 8.5,
        tvl: BigInt('1000000000000000'),
        riskScore: 5.0,
        timestamp: new Date()
      },
      {
        protocol: 'navi',
        token: 'SUI',
        apr: 7.2,
        tvl: BigInt('500000000000000'),
        riskScore: 4.5,
        timestamp: new Date()
      }
    ];
    
    const decision: InvestmentDecision = {
      taskId: `test-task-${Date.now()}`,
      timestamp: new Date(),
      selectedProtocol: 'scallop',
      availableProtocols: testProtocols,
      reasoning: 'Selected Scallop for highest APR',
      aiModel: 'heuristic',
      userAddress: '0x1234567890abcdef',
      amount: BigInt('1000000000000'),
      targetDate: new Date('2026-12-31')
    };
    
    // Save decision
    logger.info('Testing saveInvestmentDecision...');
    const blobId = await saveInvestmentDecision(decision);
    if (!blobId) {
      throw new Error('Failed to save investment decision');
    }
    logger.info(`✅ Saved investment decision: ${blobId}`);
    
    // Retrieve decision
    logger.info('Testing getInvestmentDecision...');
    const retrieved = await getInvestmentDecision(blobId);
    if (!retrieved || retrieved.taskId !== decision.taskId) {
      throw new Error('Failed to retrieve investment decision');
    }
    logger.info(`✅ Retrieved investment decision: ${blobId}`);
    
    logger.info('✅ Investment Journal Service: ALL TESTS PASSED');
    return true;
    
  } catch (error) {
    logger.error(`❌ Investment Journal Service: FAILED - ${String(error)}`);
    return false;
  }
}

/**
 * Test Snapshot Orchestrator
 */
async function testSnapshotOrchestrator(): Promise<boolean> {
  logger.info('\n=== Testing Snapshot Orchestrator ===');
  
  try {
    const testProtocols: ProtocolAPR[] = [
      {
        protocol: 'scallop',
        token: 'SUI',
        apr: 8.5,
        tvl: BigInt('1000000000000000'),
        riskScore: 5.0,
        timestamp: new Date()
      }
    ];
    
    // Test APR data snapshotting
    logger.info('Testing snapshotAPRData...');
    await snapshotAPRData(testProtocols);
    logger.info('✅ Snapshot APR data: SUCCESS');
    
    logger.info('✅ Snapshot Orchestrator: TESTS PASSED');
    return true;
    
  } catch (error) {
    logger.error(`❌ Snapshot Orchestrator: FAILED - ${String(error)}`);
    return false;
  }
}

/**
 * Main test function
 */
async function main(): Promise<void> {
  logger.info('========================================');
  logger.info('Database & Walrus Integration Test');
  logger.info('========================================');

  const results: Record<string, boolean> = {};

  try {
    // Test MongoDB connection first
    results.mongoConnection = await testMongoConnection();
    
    if (!results.mongoConnection) {
      logger.error('\n❌ MongoDB connection failed. Cannot continue with database tests.');
      process.exit(1);
    }

    // Run all tests
    results.yieldStrategyService = await testYieldStrategyService();
    results.aprSnapshotService = await testAPRSnapshotService();
    results.walrusClient = await testWalrusClient();
    results.investmentJournal = await testInvestmentJournal();
    results.snapshotOrchestrator = await testSnapshotOrchestrator();

    // Print summary
    logger.info('\n========================================');
    logger.info('Test Summary');
    logger.info('========================================');
    
    for (const [test, passed] of Object.entries(results)) {
      const status = passed ? '✅ PASSED' : '❌ FAILED';
      logger.info(`${test}: ${status}`);
    }

    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
      logger.info('\n✅ ALL TESTS PASSED');
    } else {
      logger.warn('\n⚠️  SOME TESTS FAILED');
    }

  } catch (error) {
    logger.error(`\n❌ Test suite failed: ${String(error)}`);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await closeMongoDB();
  }
}

// Run tests
main().catch(error => {
  logger.error(`Fatal error: ${String(error)}`);
  process.exit(1);
});
