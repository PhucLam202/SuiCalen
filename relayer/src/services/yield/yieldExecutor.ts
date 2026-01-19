import { Transaction } from '@mysten/sui/transactions';

export type YieldProtocol = 'scallop' | 'navi' | 'cetus' | 'suilend';

export interface YieldExecutionContext {
  packageId: string;
  registryId: string;
  clockObjectId: string;
}

export interface YieldExecutionRequest {
  taskId: string;
  /**
   * Protocol that currently holds the funds (if any).
   * MVP: may be null/undefined because we don't auto-deposit yet.
   */
  currentProtocol?: YieldProtocol | null;
  /**
   * Protocol selected by AutoAMM recommendation.
   */
  selectedProtocol: YieldProtocol;
  /**
   * Optional slippage protection for swap legs (basis points).
   * MVP: not used until swap integration is implemented.
   */
  maxSlippageBps: number;
}

export interface YieldExecutionBuildResult {
  transaction: Transaction;
  notes: string[];
}

/**
 * YieldExecutor
 *
 * MVP scope:
 * - Provides a typed execution entrypoint for "Withdraw → Swap → Transfer".
 * - Today we only execute the payment leg by calling `autopay::execute_task`.
 * - Deposit/withdraw/swap legs will be added in Phase 10.4 (PTB execution).
 */
export class YieldExecutor {
  private readonly ctx: YieldExecutionContext;

  constructor(ctx: YieldExecutionContext) {
    this.ctx = ctx;
  }

  buildYieldOptimizedPaymentTx(req: YieldExecutionRequest): YieldExecutionBuildResult {
    const tx = new Transaction();
    const notes: string[] = [];

    // MVP: no on-chain yield position management yet.
    // Execute the scheduled payment as usual.
    tx.moveCall({
      target: `${this.ctx.packageId}::autopay::execute_task`,
      arguments: [
        tx.object(req.taskId),
        tx.object(this.ctx.registryId),
        tx.object(this.ctx.clockObjectId),
      ],
    });

    notes.push(
      `MVP: executing autopay::execute_task for taskId=${req.taskId}. ` +
        `Yield legs not yet implemented (selectedProtocol=${req.selectedProtocol}).`
    );

    return { transaction: tx, notes };
  }
}

