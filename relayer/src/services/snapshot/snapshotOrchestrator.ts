/**
 * Snapshot Orchestrator
 * Coordinates saving APR data to database and investment decisions to Walrus
 */

import { ProtocolAPR } from '../yield/types';
import { saveAPRSnapshot, saveAPRSnapshots } from '../db/aprSnapshotService';
import { saveInvestmentDecision, InvestmentDecision } from '../walrus/investmentJournal';
import { YieldStrategyDocument } from '../../db/schemas';
import { logger } from '../../logger';

/**
 * Snapshot APR data to database
 * Saves all APR data from protocols to apr_snapshots collection
 * @param aprs - Array of ProtocolAPR data from Phase 10.1
 */
export async function snapshotAPRData(aprs: ProtocolAPR[]): Promise<void> {
  try {
    if (aprs.length === 0) {
      logger.warn('No APR data to snapshot');
      return;
    }

    logger.info(`Snapshotting ${aprs.length} APR entries to database`);

    // Convert ProtocolAPR[] to APRSnapshotInput[]
    const snapshots = aprs.map(apr => ({
      protocol: apr.protocol,
      token: apr.token,
      apr: apr.apr,
      tvl: apr.tvl, // BigInt - will be converted to string in service
      riskScore: apr.riskScore
    }));

    // Save in batch
    await saveAPRSnapshots(snapshots);

    logger.info(`Successfully snapshotted ${aprs.length} APR entries to database`);
    
  } catch (error) {
    logger.error(`Error snapshotting APR data: ${String(error)}`);
    throw error;
  }
}

/**
 * Snapshot investment decision to Walrus
 * Creates InvestmentDecision object and saves to Walrus, updates database
 * @param strategy - Yield strategy document from database
 * @param selectedProtocol - Protocol selected by AI/heuristic
 * @param availableProtocols - All available protocols with APR data
 * @param reasoning - Reasoning for the selection
 * @param aiModel - AI model used ('gpt-4o-mini' or 'heuristic')
 * @returns BlobId if successful, null if failed
 */
export async function snapshotInvestmentDecision(
  strategy: YieldStrategyDocument,
  selectedProtocol: string,
  availableProtocols: ProtocolAPR[],
  reasoning: string,
  aiModel?: string
): Promise<string | null> {
  try {
    logger.info(`Snapshotting investment decision for task: ${strategy.taskId}`);

    const decision: InvestmentDecision = {
      taskId: strategy.taskId,
      timestamp: new Date(),
      selectedProtocol,
      availableProtocols,
      reasoning,
      aiModel,
      userAddress: strategy.userAddress,
      amount: BigInt(strategy.amount), // Convert string back to BigInt
      targetDate: strategy.targetDate
    };

    // Save to Walrus and update database with blobId
    const blobId = await saveInvestmentDecision(decision, strategy._id || undefined);

    if (!blobId) {
      logger.error(`Failed to snapshot investment decision for task: ${strategy.taskId}`);
      return null;
    }

    logger.info(`Successfully snapshotted investment decision: ${blobId} for task: ${strategy.taskId}`);
    return blobId;

  } catch (error) {
    logger.error(`Error snapshotting investment decision: ${String(error)}`);
    return null;
  }
}

/**
 * Full snapshot workflow
 * Snapshot APR data to database, then create investment decision snapshot to Walrus
 * This is typically called after Phase 10.1 fetches APR data and Phase 10.3 makes a decision
 */
export async function snapshotFullWorkflow(
  aprs: ProtocolAPR[],
  strategy: YieldStrategyDocument,
  selectedProtocol: string,
  availableProtocols: ProtocolAPR[],
  reasoning: string,
  aiModel?: string
): Promise<string | null> {
  try {
    logger.info('Starting full snapshot workflow');

    // Step 1: Snapshot APR data to database
    await snapshotAPRData(aprs);

    // Step 2: Snapshot investment decision to Walrus
    const blobId = await snapshotInvestmentDecision(
      strategy,
      selectedProtocol,
      availableProtocols,
      reasoning,
      aiModel
    );

    if (!blobId) {
      logger.error('Full snapshot workflow failed: investment decision snapshot failed');
      return null;
    }

    logger.info(`Full snapshot workflow completed successfully: ${blobId}`);
    return blobId;

  } catch (error) {
    logger.error(`Error in full snapshot workflow: ${String(error)}`);
    throw error;
  }
}
