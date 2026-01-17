import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64 } from '@mysten/sui/utils';
import dotenv from 'dotenv';

dotenv.config();

const PACKAGE_ID = process.env.VITE_AUTOPAY_PACKAGE_ID;
const REGISTRY_ID = process.env.VITE_REGISTRY_ID;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

if (!PACKAGE_ID || !REGISTRY_ID) {
    console.error("Error: VITE_AUTOPAY_PACKAGE_ID and VITE_REGISTRY_ID must be set in .env");
    process.exit(1);
}

if (!RELAYER_PRIVATE_KEY) {
    console.error("Error: RELAYER_PRIVATE_KEY must be set in .env");
    process.exit(1);
}

// Get task ID from command line argument
const taskId = process.argv[2];
if (!taskId) {
    console.error("Usage: npm run execute-task <TASK_ID>");
    process.exit(1);
}

const client = new SuiClient({ url: getFullnodeUrl('testnet') });
const keypair = Ed25519Keypair.fromSecretKey(fromB64(RELAYER_PRIVATE_KEY));

console.log(`\n📋 Executing Task`);
console.log(`Task ID: ${taskId}`);
console.log(`Relayer Address: ${keypair.getPublicKey().toSuiAddress()}\n`);

async function executeTask() {
    try {
        // Check task status first
        const taskObj = await client.getObject({
            id: taskId,
            options: { showContent: true }
        });

        if (!taskObj.data || !taskObj.data.content) {
            console.error('❌ Task not found or already executed');
            return;
        }

        const fields = (taskObj.data.content as any).fields;
        console.log('Task Details:');
        console.log(`  Recipient: ${fields.recipient}`);
        console.log(`  Status: ${fields.status === 0 ? 'PENDING' : fields.status}`);
        console.log(`  Execute At: ${new Date(parseInt(fields.execute_at)).toISOString()}`);
        console.log(`  Amount: ${fields.balance} MIST\n`);

        if (fields.status !== 0) {
            console.error('❌ Task is not in PENDING status');
            return;
        }

        // Execute the task
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::autopay::execute_task`,
            arguments: [
                tx.object(taskId),
                tx.object(REGISTRY_ID),
                tx.object('0x6') // Clock
            ]
        });

        console.log('🔄 Signing and executing transaction...\n');

        const result = await client.signAndExecuteTransaction({
            signer: keypair,
            transaction: tx,
            options: {
                showEffects: true,
                showEvents: true,
                showObjectChanges: true
            }
        });

        if (result.effects?.status.status === 'success') {
            console.log('✅ Task Executed Successfully!');
            console.log(`Transaction Digest: ${result.digest}`);
            console.log(`\nView on Explorer: https://suiscan.xyz/testnet/tx/${result.digest}`);
            
            if (result.events) {
                console.log('\n📡 Events:');
                result.events.forEach((event: any) => {
                    console.log(`  - ${event.type}`);
                    if (event.parsedJson) {
                        console.log(`    ${JSON.stringify(event.parsedJson, null, 2)}`);
                    }
                });
            }
        } else {
            console.error('❌ Execution Failed:', result.effects?.status.error);
        }
    } catch (error: any) {
        console.error('❌ Error executing task:', error.message || error);
    }
}

executeTask();
