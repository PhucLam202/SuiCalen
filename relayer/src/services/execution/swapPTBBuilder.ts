import { SuiClient } from '@mysten/sui/client';
import { Transaction, TransactionObjectArgument, TransactionResult } from '@mysten/sui/transactions';
import BN from 'bn.js';
import { TransactionUtil, initCetusSDK } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { logger } from '../../logger';
import { SwapRequest, SwapStepResult, asObjectArg } from './types';

function parseBigIntFromUnknown(value: unknown, label: string): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) {
      throw new Error(`${label} is not a numeric string: ${value}`);
    }
    return BigInt(trimmed);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} is not a valid number: ${String(value)}`);
    }
    // Numbers may lose precision; only accept if safe.
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${label} number is not safe integer: ${String(value)}`);
    }
    return BigInt(value);
  }
  if (BN.isBN(value)) {
    return BigInt(value.toString(10));
  }
  throw new Error(`${label} has unsupported type: ${typeof value}`);
}

function getEstimatedAmountOutFromPreswap(preswap: unknown): bigint {
  if (!preswap || typeof preswap !== 'object') {
    throw new Error('Cetus preswap returned null/invalid result');
  }
  const obj = preswap as Record<string, unknown>;
  const estOut = obj.estimatedAmountOut;
  return parseBigIntFromUnknown(estOut, 'estimatedAmountOut');
}

function applySlippageBps(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error(`Invalid slippageBps: ${slippageBps}`);
  }
  const numerator = BigInt(10_000 - slippageBps);
  return (amountOut * numerator) / 10_000n;
}

export async function appendCetusSwapStep(
  tx: Transaction,
  suiClient: SuiClient,
  req: SwapRequest
): Promise<{ tx: Transaction; result: SwapStepResult }> {
  const config = req.config;
  if (config.provider !== 'cetus') {
    throw new Error(`Unsupported swap provider: ${config.provider}`);
  }

  const sdk = initCetusSDK({
    network: req.network,
    wallet: req.senderAddress,
    fullNodeUrl: process.env.SUI_RPC_URL,
  });
  // Ensure senderAddress is set for SDK helpers that rely on it.
  sdk.senderAddress = req.senderAddress;

  const pool = await sdk.Pool.getPool(config.poolId);
  if (!pool) {
    throw new Error(`Cetus pool not found: ${config.poolId}`);
  }

  const metaA = await suiClient.getCoinMetadata({ coinType: config.coinTypeA });
  const metaB = await suiClient.getCoinMetadata({ coinType: config.coinTypeB });
  if (!metaA || metaA.decimals === null || metaA.decimals === undefined) {
    throw new Error(`Missing coin metadata/decimals for coinTypeA: ${config.coinTypeA}`);
  }
  if (!metaB || metaB.decimals === null || metaB.decimals === undefined) {
    throw new Error(`Missing coin metadata/decimals for coinTypeB: ${config.coinTypeB}`);
  }

  const slippageBps = typeof config.slippageBps === 'number' ? config.slippageBps : 100;
  const amountInStr = req.amountIn.toString(10);

  // Preswap to estimate output for slippage limit.
  const preswapResult = await sdk.Swap.preswap({
    pool,
    currentSqrtPrice: pool.current_sqrt_price,
    decimalsA: metaA.decimals,
    decimalsB: metaB.decimals,
    a2b: config.a2b,
    byAmountIn: true,
    amount: amountInStr,
    coinTypeA: config.coinTypeA,
    coinTypeB: config.coinTypeB,
  });

  const estimatedOut = getEstimatedAmountOutFromPreswap(preswapResult);
  const minOut = applySlippageBps(estimatedOut, slippageBps);
  if (minOut <= 0n) {
    throw new Error(`Computed minOut is <= 0 (estimatedOut=${estimatedOut.toString()}, slippageBps=${slippageBps})`);
  }

  const swapParams = {
    pool_id: config.poolId,
    a2b: config.a2b,
    by_amount_in: true,
    amount: amountInStr,
    amount_limit: minOut.toString(10),
    coinTypeA: config.coinTypeA,
    coinTypeB: config.coinTypeB,
  };

  // Build coin inputs: one side is the real input coin, the other is a zero-value coin.
  const makeZeroCoin = (coinType: string): TransactionObjectArgument => {
    const zero: TransactionResult = TransactionUtil.callMintZeroValueCoin(tx, coinType);
    return asObjectArg(zero);
  };

  const inputCoinA: TransactionObjectArgument = config.a2b ? req.inputCoin : makeZeroCoin(config.coinTypeA);
  const inputCoinB: TransactionObjectArgument = config.a2b ? makeZeroCoin(config.coinTypeB) : req.inputCoin;

  const primaryCoinInputA = {
    targetCoin: inputCoinA,
    remainCoins: [],
    isMintZeroCoin: !config.a2b,
    tragetCoinAmount: config.a2b ? amountInStr : '0',
  };

  const primaryCoinInputB = {
    targetCoin: inputCoinB,
    remainCoins: [],
    isMintZeroCoin: config.a2b,
    tragetCoinAmount: config.a2b ? '0' : amountInStr,
  };

  const built = TransactionUtil.buildSwapTransactionWithoutTransferCoinArgs(
    sdk,
    tx,
    swapParams,
    sdk.sdkOptions,
    primaryCoinInputA,
    primaryCoinInputB
  );

  logger.info(
    `Cetus swap built (pool=${config.poolId}, a2b=${String(config.a2b)}, amountIn=${amountInStr}, minOut=${minOut.toString(10)})`
  );

  return {
    tx: built.tx,
    result: {
      provider: 'cetus',
      coinsToTransfer: built.txRes,
    },
  };
}

