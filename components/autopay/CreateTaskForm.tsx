import React, { useEffect, useRef, useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Zap, BrainCircuit } from 'lucide-react';
import { optimizeYield, type OptimizeYieldSuccessResponseDto, type YieldProtocol } from '../../services/yieldApi';
import { AutoAmmStrategyModal } from './AutoAmmStrategyModal';
import type { AutoAmmMetadataV1 } from '../../services/autoAmmMetadata';

const PACKAGE_ID = import.meta.env.VITE_AUTOPAY_PACKAGE_ID;
const REGISTRY_ID = import.meta.env.VITE_REGISTRY_ID;

// Mock known addresses for Safe-Label feature
const KNOWN_ADDRESSES = [
  '0x123...', // Example
];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === 'string');
}

type SelectedStrategy = { protocol: YieldProtocol; apr: number };

export const CreateTaskForm: React.FC<{ initialDate?: Date }> = ({ initialDate }) => {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [metadata, setMetadata] = useState('');
  const [isKnownAddress, setIsKnownAddress] = useState<boolean | null>(null);

  // Initialize date if provided
  const [executeAt, setExecuteAt] = useState(() => {
    if (initialDate) {
      // Format to datetime-local string: YYYY-MM-DDThh:mm
      const tzOffset = initialDate.getTimezoneOffset() * 60000;
      return new Date(initialDate.getTime() - tzOffset).toISOString().slice(0, 16);
    }
    return '';
  });

  // Update effect if initialDate changes from parent
  React.useEffect(() => {
    if (initialDate) {
      const tzOffset = initialDate.getTimezoneOffset() * 60000;
      setExecuteAt(new Date(initialDate.getTime() - tzOffset).toISOString().slice(0, 16));
    }
  }, [initialDate]);

  // Check known address
  useEffect(() => {
    if (recipient.length > 10) {
      // In a real app, check against a stored list in localStorage or backend
      const known = localStorage.getItem('known_addresses');
      const parsedKnown: unknown = known ? JSON.parse(known) : KNOWN_ADDRESSES;
      const knownList: string[] = isStringArray(parsedKnown) ? parsedKnown : KNOWN_ADDRESSES;
      setIsKnownAddress(knownList.includes(recipient));
    } else {
      setIsKnownAddress(null);
    }
  }, [recipient]);

  const [fee, setFee] = useState('10000000'); // Default 0.01 SUI
  const [loading, setLoading] = useState(false);

  const [optimizeWithAutoAmm, setOptimizeWithAutoAmm] = useState<boolean>(false);
  const [autoAmmOptimizeResult, setAutoAmmOptimizeResult] = useState<OptimizeYieldSuccessResponseDto | null>(null);
  const [autoAmmSelected, setAutoAmmSelected] = useState<SelectedStrategy | null>(null);
  const [autoAmmModalOpen, setAutoAmmModalOpen] = useState<boolean>(false);
  const [autoAmmLoading, setAutoAmmLoading] = useState<boolean>(false);
  const [autoAmmError, setAutoAmmError] = useState<string | null>(null);
  const lastAutoAmmKeyRef = useRef<string | null>(null);
  const autoAmmSelectedRef = useRef<SelectedStrategy | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentAccount) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!PACKAGE_ID || !REGISTRY_ID) {
      console.error('Missing config:', { PACKAGE_ID, REGISTRY_ID });
      toast.error(`Contract configuration missing! Package ID: ${PACKAGE_ID ? '✅' : '❌'}, Registry ID: ${REGISTRY_ID ? '✅' : '❌'}`);
      return;
    }

    try {
      setLoading(true);

      // Validate inputs
      if (!recipient || !recipient.startsWith('0x')) {
        toast.error('Invalid recipient address');
        setLoading(false);
        return;
      }

      const executionTimeMs = new Date(executeAt).getTime();
      const currentTime = Date.now();

      if (executionTimeMs <= currentTime) {
        toast.error('Execution time must be in the future');
        setLoading(false);
        return;
      }

      const amountMist = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000)); // SUI to MIST
      const feeMist = BigInt(fee); // Already in MIST
      const totalAmount = amountMist + feeMist;

      if (optimizeWithAutoAmm && (!autoAmmOptimizeResult || !autoAmmSelected)) {
        toast.error('Please select an AutoAMM strategy first');
        setLoading(false);
        return;
      }

      const metadataToSend: string =
        optimizeWithAutoAmm && autoAmmOptimizeResult && autoAmmSelected
          ? JSON.stringify(
            {
              version: 1,
              description: metadata,
              autoAmm: true,
              token: 'SUI',
              amountMist: amountMist.toString(),
              targetDate: new Date(executionTimeMs).toISOString(),
              recommendation: {
                protocol: autoAmmSelected.protocol,
                apr: autoAmmSelected.apr,
              },
              reasoning: autoAmmOptimizeResult.recommendation.reasoning,
              consideredTop: autoAmmOptimizeResult.considered.slice(0, 4).map((c) => ({
                protocol: c.protocol,
                apr: c.apr,
                riskScore: c.riskScore,
                tvl: c.tvl,
              })),
            } satisfies AutoAmmMetadataV1
          )
          : metadata;

      const tx = new Transaction();

      // Create a coin with exact amount for payment + fee
      const [paymentCoin] = tx.splitCoins(tx.gas, [totalAmount]);

      tx.moveCall({
        target: `${PACKAGE_ID}::autopay::create_task`,
        arguments: [
          paymentCoin,
          tx.pure.address(recipient),
          tx.pure.u64(executionTimeMs),
          tx.pure.u64(feeMist),
          tx.pure.vector('u8', Array.from(new TextEncoder().encode(metadataToSend))),
          tx.object(REGISTRY_ID),
          tx.object('0x6'), // Clock object
        ],
      });

      signAndExecuteTransaction(
        {
          transaction: tx,
          options: {
            showEffects: true,
            showEvents: true,
          },
        },
        {
          onSuccess: (result) => {
            // Save to known addresses
            const known = localStorage.getItem('known_addresses');
            const parsedKnown: unknown = known ? JSON.parse(known) : [];
            const knownList: string[] = isStringArray(parsedKnown) ? parsedKnown : [];
            const nextKnownList: string[] = knownList.includes(recipient) ? knownList : [...knownList, recipient];
            localStorage.setItem('known_addresses', JSON.stringify(nextKnownList));

            toast.success(
              <div>
                <div className="font-bold">Task scheduled successfully!</div>
                <a
                  href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on Explorer
                </a>
              </div>,
              {
                icon: '📅',
                duration: 5000,
              }
            );

            setRecipient('');
            setAmount('');
            setExecuteAt('');
            setMetadata('');
            setOptimizeWithAutoAmm(false);
            setAutoAmmOptimizeResult(null);
            setAutoAmmSelected(null);
            setAutoAmmModalOpen(false);
            setAutoAmmError(null);
            autoAmmSelectedRef.current = null;
          },
          onError: (error) => {
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            toast.error(
              <div>
                <div className="font-bold">Failed to schedule task</div>
                <div className="text-xs font-mono mt-1">{errorMessage}</div>
              </div>,
              {
                duration: 10000,
              }
            );
          },
        }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Transaction error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!optimizeWithAutoAmm) {
      setAutoAmmOptimizeResult(null);
      setAutoAmmSelected(null);
      setAutoAmmModalOpen(false);
      setAutoAmmError(null);
      setAutoAmmLoading(false);
      lastAutoAmmKeyRef.current = null;
      autoAmmSelectedRef.current = null;
      return;
    }

    const amountNum: number = Number.parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setAutoAmmOptimizeResult(null);
      setAutoAmmSelected(null);
      setAutoAmmError(null);
      setAutoAmmLoading(false);
      autoAmmSelectedRef.current = null;
      return;
    }

    const targetMs = new Date(executeAt).getTime();
    if (!Number.isFinite(targetMs) || targetMs <= Date.now()) {
      setAutoAmmOptimizeResult(null);
      setAutoAmmSelected(null);
      setAutoAmmError(null);
      setAutoAmmLoading(false);
      autoAmmSelectedRef.current = null;
      return;
    }

    const controller = new AbortController();
    const debounceId: number = window.setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          setAutoAmmLoading(true);
          setAutoAmmError(null);

          const amountMist = BigInt(Math.floor(amountNum * 1_000_000_000));
          const key = `${amountMist.toString()}:${new Date(targetMs).toISOString()}`;

          const resp = await optimizeYield({
            amountMist: amountMist.toString(),
            token: 'SUI',
            targetDate: new Date(targetMs).toISOString(),
            maxRiskScore: 6.999,
          });

          if (controller.signal.aborted) return;
          setAutoAmmOptimizeResult(resp);

          // If params changed, clear any previous selection.
          if (lastAutoAmmKeyRef.current && lastAutoAmmKeyRef.current !== key) {
            setAutoAmmSelected(null);
            autoAmmSelectedRef.current = null;
          }
          lastAutoAmmKeyRef.current = key;

          // Open modal if user hasn't selected a strategy yet.
          if (autoAmmSelectedRef.current === null) {
            setAutoAmmModalOpen(true);
          }
        } catch (err: unknown) {
          if (controller.signal.aborted) return;
          const msg = err instanceof Error ? err.message : String(err);
          setAutoAmmOptimizeResult(null);
          setAutoAmmSelected(null);
          setAutoAmmError(msg);
          autoAmmSelectedRef.current = null;
        } finally {
          if (controller.signal.aborted) return;
          setAutoAmmLoading(false);
        }
      })();
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(debounceId);
    };
  }, [amount, executeAt, optimizeWithAutoAmm]);

  return (
    <div className="bg-white border-4 border-black p-8 w-full relative">
      {loading && (
        <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 mb-4">
            <div className="absolute inset-0 border-4 border-black animate-spin"></div>
            <div className="absolute inset-4 bg-neo-primary"></div>
          </div>
          <p className="font-display font-black text-xl uppercase animate-pulse">Processing...</p>
        </div>
      )}

      <div className="mb-8 border-b-4 border-black pb-4 flex justify-between items-center">
        <h2 className="font-display text-4xl font-black uppercase">
          Schedule Payment
        </h2>
        <div className="w-4 h-4 bg-neo-accent border-2 border-black"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="font-display font-black text-xs uppercase block mb-2 tracking-widest text-gray-500">Recipient Address</label>
          <div className="relative">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className={`w-full border-2 focus:border-4 border-black p-3 font-mono font-bold focus:outline-none focus:bg-neo-bg transition-all ${isKnownAddress === false ? 'bg-yellow-50' : 'bg-white'}`}
              placeholder="0x..."
              required
            />
            {isKnownAddress === false && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-600 cursor-help" title="Unknown Address">
                <AlertTriangle size={20} />
              </div>
            )}
            {isKnownAddress === true && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
                <CheckCircle2 size={20} />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-display font-black text-xs uppercase block mb-2 tracking-widest text-gray-500">Amount (SUI)</label>
            <input
              type="number"
              step="0.000000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border-2 focus:border-4 border-black p-3 font-mono font-bold focus:outline-none focus:bg-neo-bg transition-all"
              placeholder="1.0"
              required
            />
          </div>
          <div>
            <label className="font-display font-black text-xs uppercase block mb-2 tracking-widest text-gray-500">Execution Time</label>
            <input
              type="datetime-local"
              value={executeAt}
              onChange={(e) => setExecuteAt(e.target.value)}
              className="w-full border-2 focus:border-4 border-black p-3 font-mono font-bold focus:outline-none focus:bg-neo-bg transition-all text-sm"
              required
            />
          </div>
        </div>

        {/* AutoAMM Card */}
        <div className={`border-2 border-black p-4 transition-all ${optimizeWithAutoAmm ? 'bg-neo-bg shadow-neo-sm' : 'bg-gray-50'}`}>
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div className="flex items-center gap-2">
              <BrainCircuit size={20} className={optimizeWithAutoAmm ? "text-neo-primary" : "text-gray-400"} />
              <span className={`font-display font-black text-sm uppercase ${optimizeWithAutoAmm ? 'text-black' : 'text-gray-500'}`}>
                Optimize with AutoAMM
              </span>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={optimizeWithAutoAmm}
                onChange={(e) => setOptimizeWithAutoAmm(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none border-2 border-black rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-2 after:border-black after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neo-primary"></div>
            </div>
          </label>

          {optimizeWithAutoAmm && (
            <div className="mt-4 pt-4 border-t-2 border-black/10">
              {autoAmmLoading ? (
                <div className="flex items-center gap-2 text-xs font-mono animate-pulse">
                  <div className="w-2 h-2 bg-neo-primary rounded-full"></div>
                  Finding best yields...
                </div>
              ) : autoAmmError ? (
                <div className="text-red-500 text-xs font-mono font-bold">{autoAmmError}</div>
              ) : autoAmmOptimizeResult ? (
                <div className="bg-white border-2 border-black p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-display font-bold text-xs uppercase text-gray-500">Best Strategy</span>
                    <span className="font-mono font-bold text-neo-primary">{autoAmmOptimizeResult.recommendation.protocol.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="font-display font-black text-2xl">{autoAmmOptimizeResult.recommendation.apr.toFixed(2)}% <span className="text-xs font-normal text-gray-400">APR</span></div>
                    <button
                      type="button"
                      onClick={() => setAutoAmmModalOpen(true)}
                      className="text-xs font-bold underline hover:text-neo-primary"
                    >
                      Change Strategy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-gray-500 italic">Enter amount & date to see yields</div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="font-display font-black text-xs uppercase block mb-2 tracking-widest text-gray-500">Relayer Fee (MIST)</label>
          <input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-full border-2 border-gray-300 p-2 font-mono text-sm bg-gray-50 text-gray-500 focus:outline-none"
            readOnly
          />
        </div>

        <div>
          <label className="font-display font-black text-xs uppercase block mb-2 tracking-widest text-gray-500">Metadata / Description</label>
          <input
            type="text"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            className="w-full border-2 border-black p-3 font-mono font-bold focus:outline-none focus:bg-neo-bg transition-all text-sm"
            placeholder="e.g. Monthly Rent"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !currentAccount || (optimizeWithAutoAmm && (autoAmmLoading || autoAmmSelected === null))}
          className="w-full bg-neo-primary text-white font-display font-black text-xl uppercase py-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2 group-hover:gap-3 transition-all">
              Schedule Payment <Zap size={20} fill="currentColor" />
            </span>
          )}
        </button>
      </form>

      {optimizeWithAutoAmm && autoAmmOptimizeResult && (
        <AutoAmmStrategyModal
          isOpen={autoAmmModalOpen}
          token={autoAmmOptimizeResult.token}
          recommended={autoAmmOptimizeResult.recommendation}
          considered={autoAmmOptimizeResult.considered}
          selected={autoAmmSelected}
          onSelect={(choice) => {
            setAutoAmmSelected(choice);
            autoAmmSelectedRef.current = choice;
            setAutoAmmModalOpen(false);
          }}
          onClose={() => setAutoAmmModalOpen(false)}
        />
      )}
    </div>
  );
};
