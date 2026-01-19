/**
 * MongoDB Client Setup and Connection Management
 * Initializes MongoDB client with connection string from environment variables
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { logger } from '../logger';
import { COLLECTIONS, YieldStrategyDocument, APRSnapshotDocument } from './schemas';

let client: MongoClient | null = null;
let database: Db | null = null;

/**
 * Get MongoDB connection URI from environment variables
 */
function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  return uri;
}

/**
 * Get database name from environment variables or use default
 */
function getDatabaseName(): string {
  return process.env.MONGODB_DB_NAME || 'calendefi';
}

/**
 * Initialize MongoDB client and connect to database
 * Creates indexes on collections
 */
export async function connectMongoDB(): Promise<void> {
  if (client && database) {
    logger.info('MongoDB already connected');
    return;
  }

  try {
    const uri = getMongoUri();
    const dbName = getDatabaseName();
    
    logger.info(`Connecting to MongoDB: ${dbName}`);
    
    client = new MongoClient(uri, {
      // Connection pool options
      maxPoolSize: 10,
      minPoolSize: 1,
    });

    await client.connect();
    database = client.db(dbName);
    
    logger.info('MongoDB connected successfully');
    
    // Create indexes
    await createIndexes();
    
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${String(error)}`);
    throw error;
  }
}

/**
 * Create indexes on collections for performance
 */
async function createIndexes(): Promise<void> {
  if (!database) {
    throw new Error('Database not connected. Call connectMongoDB() first.');
  }

  try {
    const yieldStrategiesCollection = database.collection<YieldStrategyDocument>(COLLECTIONS.YIELD_STRATEGIES);
    const aprSnapshotsCollection = database.collection<APRSnapshotDocument>(COLLECTIONS.APR_SNAPSHOTS);

    // Yield Strategies indexes
    await yieldStrategiesCollection.createIndex({ userAddress: 1 });
    await yieldStrategiesCollection.createIndex({ taskId: 1 }, { unique: true });
    await yieldStrategiesCollection.createIndex({ createdAt: -1 });

    // APR Snapshots indexes
    await aprSnapshotsCollection.createIndex({ protocol: 1, token: 1 });
    await aprSnapshotsCollection.createIndex({ timestamp: -1 });

    logger.info('MongoDB indexes created successfully');
  } catch (error) {
    logger.error(`Failed to create indexes: ${String(error)}`);
    // Don't throw - indexes may already exist
  }
}

/**
 * Get MongoDB database instance
 * Throws if not connected
 */
export function getDatabase(): Db {
  if (!database) {
    throw new Error('Database not connected. Call connectMongoDB() first.');
  }
  return database;
}

/**
 * Get MongoDB client instance
 * Throws if not connected
 */
export function getMongoClient(): MongoClient {
  if (!client) {
    throw new Error('MongoDB client not connected. Call connectMongoDB() first.');
  }
  return client;
}

/**
 * Get collection by name with type safety
 */
export function getCollection<T>(collectionName: string): Collection<T> {
  const db = getDatabase();
  return db.collection<T>(collectionName);
}

/**
 * Close MongoDB connection
 */
export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
    logger.info('MongoDB connection closed');
  }
}

/**
 * Test MongoDB connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await connectMongoDB();
    const db = getDatabase();
    await db.admin().ping();
    logger.info('MongoDB connection test: SUCCESS');
    return true;
  } catch (error) {
    logger.error(`MongoDB connection test: FAILED - ${String(error)}`);
    return false;
  }
}
