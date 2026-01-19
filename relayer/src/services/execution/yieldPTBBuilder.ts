import { SuiClient } from '@mysten/sui/client';
import { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';
import { SuilendClient, LENDING_MARKET_ID, LENDING_MARKET_TYPE } from '@suilend/sdk';
import { withdrawCoinPTB } from '@naviprotocol/lending';
import { logger } from '../../logger';
import {
  YieldWithdrawRequest,
  WithdrawStepResult,
  bigintToString,
  asObjectArg,
  StoredYieldPositionRef,
  asSuiObjectIdString,
  SuiObjectIdString,
} from './types';

function assertNever(x: never): never {
  throw new Error(`Unexpected variant: ${JSON.stringify(x)}`);
}

function getRequiredEnvString(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`${name} must be set in environment`);
  }
  return v.trim();
}

function getRequiredEnvObjectId(name: string): SuiObjectIdString {
  return asSuiObjectIdString(getRequiredEnvString(name));
}

function toSafeNumber(amount: bigint, label: string): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (amount > max) {
    throw new Error(`${label} is too large for protocol SDK number API: ${amount.toString()}`);
  }
  return Number(amount);
}

function mapNetworkToNaviEnv(network: YieldWithdrawRequest['network']): 'prod' | 'dev' {
  return network === 'mainnet' ? 'prod' : 'dev';
}

function requirePositionRef<P extends StoredYieldPositionRef['protocol']>(
  req: YieldWithdrawRequest,
  protocol: P
): Extract<StoredYieldPositionRef, { protocol: P }> {
  if (!req.positionRef || req.positionRef.protocol !== protocol) {
    throw new Error(`Missing/invalid positionRef for protocol=${protocol}`);
  }
  return req.positionRef as Extract<StoredYieldPositionRef, { protocol: P }>;
}

export async function appendWithdrawStep(
  tx: Transaction,
  suiClient: SuiClient,
  req: YieldWithdrawRequest
): Promise<WithdrawStepResult> {
  switch (req.protocol) {
    case 'suilend': {
      const ref = requirePositionRef(req, 'suilend');

      const lendingMarketId = (ref.lendingMarketId && ref.lendingMarketId.trim().length > 0)
        ? ref.lendingMarketId.trim()
        : LENDING_MARKET_ID;
      const lendingMarketType = (ref.lendingMarketType && ref.lendingMarketType.trim().length > 0)
        ? ref.lendingMarketType.trim()
        : LENDING_MARKET_TYPE;

      const suilend = await SuilendClient.initialize(lendingMarketId, lendingMarketType, suiClient);

      // Refresh oracle/reserve state before withdrawing.
      await suilend.refreshAll(tx);

      const withdrawn = await suilend.withdraw(
        ref.obligationOwnerCapId,
        ref.obligationId,
        req.coinType,
        bigintToString(req.amount),
        tx,
        false
      );

      return {
        protocol: 'suilend',
        withdrawnCoin: asObjectArg(withdrawn),
      };
    }

    case 'navi': {
      const ref = requirePositionRef(req, 'navi');
      const env = ref.env ?? mapNetworkToNaviEnv(req.network);

      // Navi withdraw APIs currently take `number` amounts. Enforce safety.
      const amountAsNumber = toSafeNumber(req.amount, 'Navi withdraw amount');

      const options: Partial<{ env: 'prod' | 'dev' | 'test'; accountCap: string }> = {
        env,
      };
      if (ref.accountCap && ref.accountCap.trim().length > 0) {
        options.accountCap = ref.accountCap.trim();
      }

      // Returns a TransactionResult (object arg) representing withdrawn coin.
      const withdrawn = await withdrawCoinPTB(tx, ref.identifier, amountAsNumber, options);

      return {
        protocol: 'navi',
        withdrawnCoin: asObjectArg(withdrawn),
      };
    }

    case 'scallop': {
      // Scallop SDK support is mainnet-only in your repo (see yield/scallopService.ts).
      if (req.network !== 'mainnet') {
        throw new Error('Scallop execution is mainnet-only (network must be mainnet)');
      }

      const ref = requirePositionRef(req, 'scallop');
      if (!ref.marketCoinId || ref.marketCoinId.trim().length === 0) {
        throw new Error('Scallop positionRef.marketCoinId is required');
      }

      /**
       * Scallop "withdraw" is implemented as a redeem of a MarketCoin.
       * We build a Move call directly, using IDs configured via env vars.
       *
       * NOTE: The redeem amount is encoded by the MarketCoin object we pass in.
       * `req.amount` is not used here unless upstream splits the MarketCoin first.
       */
      const SCALLOP_PACKAGE_ID = getRequiredEnvObjectId('SCALLOP_PACKAGE_ID');
      const SCALLOP_VERSION_ID = getRequiredEnvObjectId('SCALLOP_VERSION_ID');
      const SCALLOP_MARKET_ID = getRequiredEnvObjectId('SCALLOP_MARKET_ID');
      const CLOCK_ID: SuiObjectIdString = asSuiObjectIdString('0x6');

      const marketCoin = tx.object(asSuiObjectIdString(ref.marketCoinId.trim()));
      const withdrawn = tx.moveCall({
        target: `${SCALLOP_PACKAGE_ID}::redeem::redeem`,
        typeArguments: [req.coinType],
        arguments: [
          tx.object(SCALLOP_VERSION_ID),
          tx.object(SCALLOP_MARKET_ID),
          marketCoin,
          tx.object(CLOCK_ID),
        ],
      });

      logger.info(
        `Scallop redeem appended (marketCoinId=${ref.marketCoinId}, coinType=${req.coinType}, requestedAmount=${req.amount.toString(10)})`
      );

      return {
        protocol: 'scallop',
        withdrawnCoin: asObjectArg(withdrawn),
      };
    }

    default:
      return assertNever(req.protocol);
  }
}

export function isTransactionObjectArgument(value: unknown): value is TransactionObjectArgument {
  // Runtime type guard is best-effort only.
  return typeof value === 'object' && value !== null;
}

