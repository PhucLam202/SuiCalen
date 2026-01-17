import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64 } from '@mysten/sui/utils';
import dotenv from 'dotenv';

dotenv.config();

// ===== Environment Variables =====
const PACKAGE_ID: string | undefined = process.env.VITE_AUTOPAY_PACKAGE_ID;
const REGISTRY_ID: string | undefined = process.env.VITE_REGISTRY_ID;
const RELAYER_PRIVATE_KEY: string | undefined = process.env.RELAYER_PRIVATE_KEY;
const GAS_STATION_PRIVATE_KEY: string | undefined = process.env.GAS_STATION_PRIVATE_KEY;
const GAS_BUDGET_LIMIT: number = parseInt(process.env.GAS_BUDGET_LIMIT ?? '20000000', 10);

// ===== Security Constants =====
const MAX_ALLOWED_GAS_BUDGET: number = 50_000_000; // 0.05 SUI - absolute max to prevent drain attacks
const MIN_GAS_BUDGET: number = 5_000_000; // 0.005 SUI - minimum for transaction to succeed

// ===== Validation =====
if (!PACKAGE_ID) {
    console.error("Error: VITE_AUTOPAY_PACKAGE_ID not set in .env");
    process.exit(1);
}

if (!REGISTRY_ID) {
    console.error("Error: VITE_REGISTRY_ID not set in .env");
    process.exit(1);
}

if (!RELAYER_PRIVATE_KEY) {
    console.warn("Warning: RELAYER_PRIVATE_KEY not set in .env. Execution will fail.");
}

if (!GAS_STATION_PRIVATE_KEY) {
    console.warn("Warning: GAS_STATION_PRIVATE_KEY not set in .env. Sponsored transactions disabled, relayer will pay gas.");
}

// Validate gas budget is within safe limits
if (GAS_BUDGET_LIMIT > MAX_ALLOWED_GAS_BUDGET) {
    console.error(`Error: GAS_BUDGET_LIMIT (${GAS_BUDGET_LIMIT}) exceeds MAX_ALLOWED_GAS_BUDGET (${MAX_ALLOWED_GAS_BUDGET}). Capping to max.`);
}
if (GAS_BUDGET_LIMIT < MIN_GAS_BUDGET) {
    console.warn(`Warning: GAS_BUDGET_LIMIT (${GAS_BUDGET_LIMIT}) is below MIN_GAS_BUDGET (${MIN_GAS_BUDGET}). Transactions may fail.`);
}

/**
 * Get validated gas budget within safe limits
 */
function getValidatedGasBudget(): number {
    if (GAS_BUDGET_LIMIT > MAX_ALLOWED_GAS_BUDGET) {
        return MAX_ALLOWED_GAS_BUDGET;
    }
    if (GAS_BUDGET_LIMIT < MIN_GAS_BUDGET) {
        return MIN_GAS_BUDGET;
    }
    return GAS_BUDGET_LIMIT;
}

// ===== Setup Client =====
const client: SuiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// ===== Setup Keypairs =====
let relayerKeypair: Ed25519Keypair | undefined;
let gasStationKeypair: Ed25519Keypair | undefined;
let relayerAddress: string | undefined;
let gasStationAddress: string | undefined;

try {
    if (RELAYER_PRIVATE_KEY) {
        relayerKeypair = Ed25519Keypair.fromSecretKey(fromB64(RELAYER_PRIVATE_KEY));
        relayerAddress = relayerKeypair.getPublicKey().toSuiAddress();
        console.log(`Relayer Address: ${relayerAddress}`);
    }
} catch (e) {
    console.error("Error loading relayer keypair:", e);
}

try {
    if (GAS_STATION_PRIVATE_KEY) {
        gasStationKeypair = Ed25519Keypair.fromSecretKey(fromB64(GAS_STATION_PRIVATE_KEY));
        gasStationAddress = gasStationKeypair.getPublicKey().toSuiAddress();
        console.log(`Gas Station Address: ${gasStationAddress}`);
        console.log(`Gas Budget Limit: ${GAS_BUDGET_LIMIT} MIST (${GAS_BUDGET_LIMIT / 1_000_000_000} SUI)`);
    }
} catch (e) {
    console.error("Error loading gas station keypair:", e);
}

async function scanAndExecute() {
    console.log(`\n[${new Date().toISOString()}] Scanning for due tasks...`);
    
    try {
        // 1. Query Events to find tasks
        const events = await client.queryEvents({
            query: { MoveEventType: `${PACKAGE_ID}::autopay::TaskCreated` },
            limit: 50,
            order: 'descending'
        });

        if (events.data.length === 0) {
            console.log("No tasks found.");
            return;
        }

        const taskIds = events.data.map((e: any) => e.parsedJson.task_id);
        console.log(`Found ${taskIds.length} tasks from events.`);

        // 2. Fetch Object Details
        const objects = await client.multiGetObjects({
            ids: taskIds,
            options: { showContent: true }
        });

        const now = Date.now();
        const dueTasks: any[] = [];

        objects.forEach((obj) => {
            if (obj.data && obj.data.content) {
                const fields = (obj.data.content as any).fields;
                const executeAt = parseInt(fields.execute_at);
                const status = fields.status; // Check status field (Phase 4)
                
                // Check if task is due, exists, and status is PENDING (0)
                if (now >= executeAt && status === 0) {
                    dueTasks.push({
                        id: obj.data.objectId,
                        executeAt,
                        recipient: fields.recipient,
                        status
                    });
                }
            }
        });

        console.log(`Found ${dueTasks.length} due tasks ready for execution.`);

        // 3. Execute Due Tasks
        if (!relayerKeypair) {
            console.log("No relayer key configured. Skipping execution.");
            return;
        }

        for (const task of dueTasks) {
            console.log(`Executing Task ${task.id}...`);
            await executeTask(task.id);
        }

    } catch (error) {
        console.error("Error in scan loop:", error);
    }
}

async function executeTask(taskId: string): Promise<void> {
    if (!relayerKeypair || !relayerAddress) {
        console.error("❌ Relayer keypair not configured");
        return;
    }

    try {
        // Build the transaction
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::autopay::execute_task`,
            arguments: [
                tx.object(taskId),
                tx.object(REGISTRY_ID!),
                tx.object('0x6') // Clock object
            ]
        });

        // Check if Gas Station is configured for sponsored transactions
        if (gasStationKeypair && gasStationAddress) {
            await executeSponsoredTransaction(tx, taskId);
        } else {
            // Fallback: Relayer pays gas (legacy mode)
            await executeDirectTransaction(tx, taskId);
        }
    } catch (e) {
        console.error(`❌ Failed to execute task ${taskId}:`, e);
    }
}

/**
 * Execute transaction with Gas Station sponsorship (dual-signature)
 * Relayer signs the transaction, Gas Station pays for gas
 */
async function executeSponsoredTransaction(tx: Transaction, taskId: string): Promise<void> {
    if (!relayerKeypair || !relayerAddress || !gasStationKeypair || !gasStationAddress) {
        throw new Error("Missing keypairs for sponsored transaction");
    }

    const validatedGasBudget: number = getValidatedGasBudget();
    
    console.log(`  [Sponsored] Gas Station: ${gasStationAddress}`);
    console.log(`  [Sponsored] Gas Budget: ${validatedGasBudget} MIST (${validatedGasBudget / 1_000_000_000} SUI)`);

    // 1. Set sender (relayer) and gas owner (gas station)
    tx.setSender(relayerAddress);
    tx.setGasOwner(gasStationAddress);
    tx.setGasBudget(validatedGasBudget);

    // 2. Build transaction bytes
    const txBytes: Uint8Array = await tx.build({ client });

    // 3. Relayer signs (sender signature)
    const relayerSignature = await relayerKeypair.signTransaction(txBytes);

    // 4. Gas Station signs (gas owner signature)
    const gasStationSignature = await gasStationKeypair.signTransaction(txBytes);

    // 5. Execute with both signatures
    const result = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: [relayerSignature.signature, gasStationSignature.signature],
        options: {
            showEffects: true,
            showEvents: true
        }
    });

    if (result.effects?.status.status === 'success') {
        console.log(`✅ [Sponsored] Execution Success! Digest: ${result.digest}`);
        logSponsoredTransaction(taskId, result.digest, validatedGasBudget);
    } else {
        console.error(`❌ [Sponsored] Execution Failed: ${result.effects?.status.error}`);
    }
}

/**
 * Execute transaction directly (relayer pays gas) - fallback mode
 */
async function executeDirectTransaction(tx: Transaction, taskId: string): Promise<void> {
    if (!relayerKeypair) {
        throw new Error("Missing relayer keypair");
    }

    console.log(`  [Direct] Relayer paying gas (no Gas Station configured)`);

    const result = await client.signAndExecuteTransaction({
        signer: relayerKeypair,
        transaction: tx,
        options: {
            showEffects: true,
            showEvents: true
        }
    });

    if (result.effects?.status.status === 'success') {
        console.log(`✅ [Direct] Execution Success! Digest: ${result.digest}`);
    } else {
        console.error(`❌ [Direct] Execution Failed: ${result.effects?.status.error}`);
    }
}

/**
 * Log sponsored transaction for audit purposes
 */
function logSponsoredTransaction(taskId: string, digest: string, gasBudget: number): void {
    const logEntry = {
        timestamp: new Date().toISOString(),
        taskId,
        digest,
        gasBudget,
        gasStation: gasStationAddress,
        relayer: relayerAddress
    };
    console.log(`  [Audit] Sponsored TX:`, JSON.stringify(logEntry));
}

// Run immediately then loop
scanAndExecute();
setInterval(scanAndExecute, 30000); // Check every 30 seconds
