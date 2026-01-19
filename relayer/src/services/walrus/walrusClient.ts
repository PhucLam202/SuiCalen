/**
 * Walrus Client
 * HTTP client for uploading and retrieving blobs from Walrus decentralized storage
 */

import { logger } from '../../logger';

/**
 * Walrus upload response
 */
interface WalrusUploadResponse {
  blobId?: string;
  blobObject?: {
    blobId?: string;
    registeredEpoch?: number;
    encodingType?: string;
  };
  cost?: unknown;
  alreadyCertified?: boolean;
  newlyCreated?: boolean;
}

/**
 * Walrus client configuration
 */
interface WalrusClientConfig {
  publisherUrl?: string;
  aggregatorUrl?: string;
  epochs?: number;
}

/**
 * Get Walrus configuration from environment variables
 */
function getWalrusConfig(): WalrusClientConfig {
  return {
    publisherUrl: process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus.gg',
    aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus.gg',
    epochs: process.env.WALRUS_EPOCHS ? parseInt(process.env.WALRUS_EPOCHS, 10) : 1
  };
}

/**
 * Upload data to Walrus
 * @param data - Data to upload (will be serialized to JSON)
 * @returns BlobId string if successful, null if failed
 */
export async function uploadToWalrus(data: unknown): Promise<string | null> {
  const config = getWalrusConfig();
  
  try {
    const jsonData = JSON.stringify(data, (key, value) => {
      // Handle BigInt serialization
      if (typeof value === 'bigint') {
        return value.toString();
      }
      // Handle Date serialization
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }, 2);

    const url = `${config.publisherUrl}/v1/blobs`;
    const params = new URLSearchParams();
    
    if (config.epochs) {
      params.append('epochs', config.epochs.toString());
    }
    params.append('deletable', 'true'); // Default to deletable
    
    const fullUrl = `${url}?${params.toString()}`;

    logger.info(`Uploading to Walrus: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Walrus upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      return null;
    }

    const result: WalrusUploadResponse = await response.json();
    
    // Extract blobId from response
    const blobId = result.blobId || result.blobObject?.blobId;
    
    if (!blobId) {
      logger.error('Walrus upload response missing blobId');
      return null;
    }

    logger.info(`Uploaded to Walrus successfully: ${blobId}`);
    return blobId;
    
  } catch (error) {
    logger.error(`Error uploading to Walrus: ${String(error)}`);
    return null;
  }
}

/**
 * Retrieve data from Walrus by blobId
 * @param blobId - Blob ID to retrieve
 * @returns Parsed JSON data if successful, null if failed
 */
export async function getFromWalrus(blobId: string): Promise<unknown | null> {
  const config = getWalrusConfig();
  
  try {
    const url = `${config.aggregatorUrl}/v1/blobs/${blobId}`;

    logger.info(`Retrieving from Walrus: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Walrus retrieval failed: ${response.status} ${response.statusText} - ${errorText}`);
      return null;
    }

    // Check content type - could be JSON or raw bytes
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      logger.info(`Retrieved from Walrus successfully: ${blobId}`);
      return data;
    } else {
      // Raw bytes - parse as text and try to parse as JSON
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        logger.info(`Retrieved from Walrus successfully: ${blobId}`);
        return data;
      } catch {
        // Not JSON, return raw text
        logger.warn(`Walrus blob ${blobId} is not JSON, returning raw text`);
        return text;
      }
    }
    
  } catch (error) {
    logger.error(`Error retrieving from Walrus: ${String(error)}`);
    return null;
  }
}

/**
 * Test Walrus connection by uploading a small test blob
 */
export async function testWalrusConnection(): Promise<boolean> {
  try {
    const testData = {
      test: true,
      timestamp: new Date().toISOString()
    };
    
    const blobId = await uploadToWalrus(testData);
    
    if (!blobId) {
      logger.error('Walrus connection test: FAILED - upload failed');
      return false;
    }
    
    const retrieved = await getFromWalrus(blobId);
    
    if (!retrieved) {
      logger.error('Walrus connection test: FAILED - retrieval failed');
      return false;
    }
    
    logger.info('Walrus connection test: SUCCESS');
    return true;
    
  } catch (error) {
    logger.error(`Walrus connection test: FAILED - ${String(error)}`);
    return false;
  }
}
