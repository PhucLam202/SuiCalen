/**
 * APR Snapshot Service
 * Operations for storing and querying APR snapshots from MongoDB
 */

import { getCollection } from '../../db/mongoClient';
import { COLLECTIONS, APRSnapshotDocument, APRSnapshotInput } from '../../db/schemas';
import { logger } from '../../logger';

/**
 * Convert APRSnapshotInput to APRSnapshotDocument (for insertion)
 */
function inputToDocument(input: APRSnapshotInput): Omit<APRSnapshotDocument, '_id'> {
  return {
    protocol: input.protocol,
    token: input.token,
    apr: input.apr,
    tvl: input.tvl.toString(), // Convert BigInt to string
    riskScore: input.riskScore ?? 5.0,
    timestamp: new Date()
  };
}

/**
 * Convert APRSnapshotDocument to return format (with BigInt conversion)
 */
function documentToSnapshot(doc: APRSnapshotDocument): APRSnapshotDocument & { tvl: bigint } {
  return {
    ...doc,
    tvl: BigInt(doc.tvl) // Convert string back to BigInt
  };
}

/**
 * Save a single APR snapshot
 */
export async function saveAPRSnapshot(input: APRSnapshotInput): Promise<APRSnapshotDocument & { tvl: bigint }> {
  try {
    const collection = getCollection<APRSnapshotDocument>(COLLECTIONS.APR_SNAPSHOTS);
    
    const document = inputToDocument(input);
    const result = await collection.insertOne(document as APRSnapshotDocument);
    
    if (!result.insertedId) {
      throw new Error('Failed to insert APR snapshot');
    }
    
    const inserted = await collection.findOne({ _id: result.insertedId });
    
    if (!inserted) {
      throw new Error('Failed to retrieve inserted APR snapshot');
    }
    
    logger.info(`Saved APR snapshot: ${result.insertedId} for ${input.protocol}/${input.token}`);
    
    return documentToSnapshot(inserted);
  } catch (error) {
    logger.error(`Error saving APR snapshot: ${String(error)}`);
    throw error;
  }
}

/**
 * Save multiple APR snapshots in batch
 */
export async function saveAPRSnapshots(inputs: APRSnapshotInput[]): Promise<(APRSnapshotDocument & { tvl: bigint })[]> {
  try {
    if (inputs.length === 0) {
      return [];
    }
    
    const collection = getCollection<APRSnapshotDocument>(COLLECTIONS.APR_SNAPSHOTS);
    
    const documents = inputs.map(input => inputToDocument(input));
    const result = await collection.insertMany(documents as APRSnapshotDocument[]);
    
    const insertedIds = Object.values(result.insertedIds);
    const inserted = await collection.find({ _id: { $in: insertedIds } })
      .sort({ timestamp: -1 })
      .toArray();
    
    logger.info(`Saved ${inputs.length} APR snapshots in batch`);
    
    return inserted.map(doc => documentToSnapshot(doc));
  } catch (error) {
    logger.error(`Error saving APR snapshots in batch: ${String(error)}`);
    throw error;
  }
}

/**
 * Get historical APR data within a time range
 * Returns snapshots sorted by timestamp DESC (newest first)
 */
export async function getHistoricalAPR(
  protocol: string,
  token: string,
  hours: number
): Promise<(APRSnapshotDocument & { tvl: bigint })[]> {
  try {
    const collection = getCollection<APRSnapshotDocument>(COLLECTIONS.APR_SNAPSHOTS);
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);
    
    const documents = await collection.find({
      protocol: protocol as APRSnapshotDocument['protocol'],
      token,
      timestamp: { $gte: cutoffTime }
    })
      .sort({ timestamp: -1 })
      .toArray();
    
    return documents.map(doc => documentToSnapshot(doc));
  } catch (error) {
    logger.error(`Error getting historical APR for ${protocol}/${token}: ${String(error)}`);
    throw error;
  }
}

/**
 * Get the latest APR snapshot for a protocol and token
 */
export async function getLatestAPR(
  protocol: string,
  token: string
): Promise<(APRSnapshotDocument & { tvl: bigint }) | null> {
  try {
    const collection = getCollection<APRSnapshotDocument>(COLLECTIONS.APR_SNAPSHOTS);
    
    const document = await collection.findOne({
      protocol: protocol as APRSnapshotDocument['protocol'],
      token
    }, {
      sort: { timestamp: -1 }
    });
    
    if (!document) {
      return null;
    }
    
    return documentToSnapshot(document);
  } catch (error) {
    logger.error(`Error getting latest APR for ${protocol}/${token}: ${String(error)}`);
    throw error;
  }
}

/**
 * Get APR history (last N snapshots) for a protocol and token
 * Sorted by timestamp DESC (newest first)
 */
export async function getAPRHistory(
  protocol: string,
  token: string,
  limit: number
): Promise<(APRSnapshotDocument & { tvl: bigint })[]> {
  try {
    const collection = getCollection<APRSnapshotDocument>(COLLECTIONS.APR_SNAPSHOTS);
    
    const documents = await collection.find({
      protocol: protocol as APRSnapshotDocument['protocol'],
      token
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return documents.map(doc => documentToSnapshot(doc));
  } catch (error) {
    logger.error(`Error getting APR history for ${protocol}/${token}: ${String(error)}`);
    throw error;
  }
}
