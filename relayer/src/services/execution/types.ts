/**
 * Execution-layer DTOs for building atomic PTBs (Transaction) on Sui.
 *
 * IMPORTANT:
 * - Keep these types JSON-serializable where possible so we can persist them in MongoDB.
 * - Do NOT use `any` (repo rule).
 */
import type { TransactionObjectArgument, TransactionResult } from '@mysten/sui/transactions';

declare const brandAddress: unique symbol;
declare const brandObjectId: unique symbol;
declare const brandCoinType: unique symbol;

export type SuiAddressString = string & { readonly [brandAddress]: true };
export type SuiObjectIdString = string & { readonly [brandObjectId]: true };
export type CoinTypeString = string & { readonly [brandCoinType]: true };

export type YieldProtocol = 'navi' | 'suilend' | 'scallop';
export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet';

export type NaviEnv = 'prod' | 'dev' | 'test';

export function asSuiAddressString(value: string): SuiAddressString {
  // Basic validation: 0x + 64 hex chars is typical for Sui addresses.
  const v = value.trim();
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(v)) {
    throw new Error(`Invalid Sui address: ${value}`);
  }
  return v as SuiAddressString;
}

export function asSuiObjectIdString(value: string): SuiObjectIdString {
  const v = value.trim();
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(v)) {
    throw new Error(`Invalid Sui object id: ${value}`);
  }
  return v as SuiObjectIdString;
}

export function asCoinTypeString(value: string): CoinTypeString {
  // Accept normalized struct tags like: 0x2::sui::SUI or 0x...::module::Type<...>
  const v = value.trim();
  if (!/^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*(<.*>)?$/.test(v)) {
    throw new Error(`Invalid coin type: ${value}`);
  }
  return v as CoinTypeString;
}

/**
 * DB-storable reference to a user position required for withdrawals.
 * (This is intentionally minimal: we only store identifiers required by SDK calls.)
 */
export type StoredYieldPositionRef =
  | {
      protocol: 'suilend';
      obligationOwnerCapId: string;
      obligationId: string;
      lendingMarketId?: string;
      lendingMarketType?: string;
    }
  | {
      protocol: 'navi';
      /**
       * Pool identifier accepted by Navi SDK (coinType string, pool object, or numeric assetId).
       * We store string | number only (JSON-serializable).
       */
      identifier: string | number;
      /**
       * Optional Navi AccountCap object id (recommended for account-cap protected flows).
       */
      accountCap?: string;
      /**
       * Navi env mapping (prod=mainnet, dev=testnet, test=their internal testing env).
       */
      env?: NaviEnv;
    }
  | {
      protocol: 'scallop';
      /**
       * Scallop supply positions are represented by a MarketCoin object id (sCoin-like).
       * Withdrawing is a redeem operation that consumes this object and returns the
       * underlying Coin<coinType>.
       *
       * NOTE: Scallop execution is mainnet-only in this repo.
       */
      marketCoinId: string;
      /**
       * Optional human-friendly pool coin name (e.g. "usdc", "sui") for debugging only.
       * Execution uses `coinType` from the strategy document.
       */
      poolCoinName?: string;
    };

export type StoredSwapConfig =
  | {
      provider: 'cetus';
      poolId: string;
      coinTypeA: string;
      coinTypeB: string;
      a2b: boolean;
      /**
       * Slippage in basis points. Example: 100 = 1%.
       * If omitted, execution layer will default to 100 bps.
       */
      slippageBps?: number;
    };

export interface YieldWithdrawRequest {
  protocol: YieldProtocol;
  network: SuiNetwork;
  ownerAddress: SuiAddressString;
  targetAddress: SuiAddressString;
  amount: bigint;
  coinType: CoinTypeString;
  positionRef: StoredYieldPositionRef;
}

export interface SwapRequest {
  provider: 'cetus';
  network: SuiNetwork;
  senderAddress: SuiAddressString;
  /**
   * Swap config must include pool and coin types.
   */
  config: StoredSwapConfig & { provider: 'cetus' };
  /**
   * Coin object to swap. Must match config.coinTypeA or config.coinTypeB (depending on direction).
   */
  inputCoin: TransactionObjectArgument;
  amountIn: bigint;
}

export interface WithdrawStepResult {
  protocol: YieldProtocol;
  withdrawnCoin: TransactionObjectArgument;
}

export interface SwapStepResult {
  provider: 'cetus';
  /**
   * Coins created/returned by the swap step that must be transferred out
   * (to avoid leaving assets owned by the relayer address).
   */
  coinsToTransfer: TransactionObjectArgument[];
}

export interface ExecutionResult {
  digest: string;
  effectsStatus: 'success' | 'failure';
}

export interface BuiltAtomicTransaction {
  coinsToTransfer: TransactionObjectArgument[];
  // Keep a reference for debugging/dev-inspect if needed.
  // NOTE: Transaction type is imported in runtime modules, not here.
}

/**
 * Helper: normalize bigint to string for SDKs expecting string amounts.
 */
export function bigintToString(amount: bigint): string {
  if (amount < 0n) {
    throw new Error('Amount must be non-negative');
  }
  return amount.toString(10);
}

/**
 * Helper to safely coerce a TransactionResult into a TransactionObjectArgument.
 * Many SDKs return TransactionResult (which is compatible as object arg).
 */
export function asObjectArg(value: TransactionResult): TransactionObjectArgument {
  return value as unknown as TransactionObjectArgument;
}

