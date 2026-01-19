import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';
import { fromB64 } from '@mysten/sui/utils';
import { logger } from '../../logger';
import type { YieldStrategyDocument } from '../../db/schemas';
import { appendWithdrawStep } from './yieldPTBBuilder';
import { appendCetusSwapStep } from './swapPTBBuilder';
import {
  ExecutionResult,
  StoredSwapConfig,
  StoredYieldPositionRef,
  YieldProtocol,
  asCoinTypeString,
  asSuiAddressString,
} from './types';

type Network = 'mainnet' | 'testnet' | 'devnet';

function getEnvString(name: string): string | null {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function getEnvInt(name: string, fallback: number): number {
  const raw = getEnvString(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getNetwork(): Network {
  const raw = (process.env.SUI_NETWORK || 'testnet').toLowerCase();
  if (raw === 'mainnet' || raw === 'testnet' || raw === 'devnet') {
    return raw;
  }
  return 'testnet';
}

function getSuiClient(): SuiClient {
  const network = getNetwork();
  const url = getEnvString('SUI_RPC_URL') ?? getFullnodeUrl(network);
  return new SuiClient({ url });
}

function getRelayerKeypair(): Ed25519Keypair {
  const pk = getEnvString('RELAYER_PRIVATE_KEY');
  if (!pk) {
    throw new Error('RELAYER_PRIVATE_KEY must be set in environment');
  }
  return Ed25519Keypair.fromSecretKey(fromB64(pk));
}

function getGasStationKeypair(): Ed25519Keypair | null {
  const pk = getEnvString('GAS_STATION_PRIVATE_KEY');
  if (!pk) {
    return null;
  }
  return Ed25519Keypair.fromSecretKey(fromB64(pk));
}

function getValidatedGasBudget(): number {
  const configured = getEnvInt('GAS_BUDGET_LIMIT', 20_000_000);
  const MAX_ALLOWED_GAS_BUDGET = 50_000_000;
  const MIN_GAS_BUDGET = 5_000_000;

  if (configured > MAX_ALLOWED_GAS_BUDGET) return MAX_ALLOWED_GAS_BUDGET;
  if (configured < MIN_GAS_BUDGET) return MIN_GAS_BUDGET;
  return configured;
}

function parseYieldProtocol(value: string): YieldProtocol {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'navi' || normalized === 'suilend' || normalized === 'scallop') {
    return normalized;
  }
  throw new Error(`Unsupported yield protocol for withdraw: ${value}`);
}

function requirePositionRef(strategy: YieldStrategyDocument): StoredYieldPositionRef {
  if (!strategy.positionRef) {
    throw new Error('Yield strategy missing positionRef (required for withdraw execution)');
  }
  return strategy.positionRef;
}

function requireCoinType(strategy: YieldStrategyDocument): string {
  if (!strategy.coinType || strategy.coinType.trim().length === 0) {
    throw new Error('Yield strategy missing coinType (required for withdraw execution)');
  }
  return strategy.coinType.trim();
}

function requireSwapConfig(strategy: YieldStrategyDocument): StoredSwapConfig {
  if (!strategy.swapConfig) {
    throw new Error('Yield strategy missing swapConfig');
  }
  return strategy.swapConfig;
}

export async function buildYieldWithdrawalTransaction(
  strategy: YieldStrategyDocument & { amount: bigint },
  ctx: { client: SuiClient; network: Network; senderAddress: string }
): Promise<{ tx: Transaction; coinsToTransfer: TransactionObjectArgument[] }> {
  // Build atomic transaction: withdraw -> optional swap -> transfer.
  let tx: Transaction = new Transaction();
  const protocol = parseYieldProtocol(strategy.selectedProtocol);
  const coinType = requireCoinType(strategy);
  const positionRef = requirePositionRef(strategy);

  const withdrawRes = await appendWithdrawStep(tx, ctx.client, {
    protocol,
    network: ctx.network,
    ownerAddress: asSuiAddressString(strategy.userAddress),
    targetAddress: asSuiAddressString(strategy.targetAddress),
    amount: strategy.amount,
    coinType: asCoinTypeString(coinType),
    positionRef,
  });

  let coinsToTransfer: TransactionObjectArgument[] = [withdrawRes.withdrawnCoin];

  // Optional swap (Cetus) if swapConfig is present.
  if (strategy.swapConfig) {
    const swapConfig = requireSwapConfig(strategy);
    if (swapConfig.provider !== 'cetus') {
      throw new Error(`Unsupported swap provider: ${swapConfig.provider}`);
    }

    const swapBuilt = await appendCetusSwapStep(tx, ctx.client, {
      provider: 'cetus',
      network: ctx.network,
      senderAddress: asSuiAddressString(ctx.senderAddress),
      config: swapConfig,
      inputCoin: withdrawRes.withdrawnCoin,
      amountIn: strategy.amount,
    });
    tx = swapBuilt.tx;
    coinsToTransfer = swapBuilt.result.coinsToTransfer;
  }

  // Transfer all produced coins to the target (prevents leaving assets owned by relayer).
  tx.transferObjects(coinsToTransfer, tx.pure.address(strategy.targetAddress));

  // Gas budget controls
  const gasBudget = getValidatedGasBudget();
  tx.setGasBudget(gasBudget);

  return { tx, coinsToTransfer };
}

export async function executeYieldWithdrawal(
  strategy: YieldStrategyDocument & { amount: bigint }
): Promise<ExecutionResult> {
  const network = getNetwork();
  const client = getSuiClient();
  const relayerKeypair = getRelayerKeypair();
  const gasStationKeypair = getGasStationKeypair();

  const relayerAddress = relayerKeypair.getPublicKey().toSuiAddress();
  const gasStationAddress = gasStationKeypair ? gasStationKeypair.getPublicKey().toSuiAddress() : null;

  const built = await buildYieldWithdrawalTransaction(strategy, { client, network, senderAddress: relayerAddress });
  const tx = built.tx;

  // Execute direct or sponsored.
  if (gasStationKeypair && gasStationAddress) {
    // Sponsored: relayer is sender, gas station is gas owner.
    tx.setSender(relayerAddress);
    tx.setGasOwner(gasStationAddress);

    const txBytes: Uint8Array = await tx.build({ client });
    const relayerSig = await relayerKeypair.signTransaction(txBytes);
    const gasSig = await gasStationKeypair.signTransaction(txBytes);

    const result = await client.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: [relayerSig.signature, gasSig.signature],
      options: { showEffects: true, showEvents: true },
    });

    const ok = result.effects?.status.status === 'success';
    logger.info(`[YieldExecution][Sponsored] digest=${result.digest} status=${result.effects?.status.status}`);
    return { digest: result.digest, effectsStatus: ok ? 'success' : 'failure' };
  }

  const result = await client.signAndExecuteTransaction({
    signer: relayerKeypair,
    transaction: tx,
    options: { showEffects: true, showEvents: true },
  });

  const ok = result.effects?.status.status === 'success';
  logger.info(`[YieldExecution][Direct] digest=${result.digest} status=${result.effects?.status.status}`);
  return { digest: result.digest, effectsStatus: ok ? 'success' : 'failure' };
}

