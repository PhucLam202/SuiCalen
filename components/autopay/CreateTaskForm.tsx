import React, { useEffect, useRef, useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { NeoButton } from '../NeoButton';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
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

      console.log('Creating task with:', {
        recipient,
        amount: amountMist.toString(),
        fee: feeMist.toString(),
        total: totalAmount.toString(),
        executeAt: new Date(executionTimeMs).toISOString(),
        metadata: metadataToSend,
        packageId: PACKAGE_ID,
        registryId: REGISTRY_ID,
      });

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

      console.log('Transaction prepared, signing...');

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
            console.log('✅ Task created successfully!', result);
            console.log('Transaction digest:', result.digest);
            
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
            console.error('❌ Error creating task:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            
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
      console.error('❌ Error preparing transaction:', error);
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
    <div className="glass border-[1.5px] border-white/20 p-8 shadow-soft-lg rounded-xl w-full relative overflow-hidden">
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 mb-4">
             {/* Kiosk Animation */}
             <div className="absolute inset-0 border-4 border-black rounded-lg bg-neo-bg"></div>
             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-2 bg-black"></div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-neo-primary rounded-full animate-bounce shadow-neo"></div>
             <div className="absolute top-4 right-4 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
          </div>
          <p className="font-display font-bold text-xl animate-pulse">Processing Transaction...</p>
          <p className="font-mono text-sm text-gray-500 mt-2">Securing assets in Sui Kiosk</p>
        </div>
      )}

      <h2 className="font-display text-2xl font-black uppercase mb-6 border-b-2 border-black/10 pb-2">
        Schedule Payment
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-mono font-bold text-sm block mb-1">Recipient Address</label>
          <div className="relative">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className={`w-full border-2 p-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-primary/20 transition-all rounded-lg ${
                isKnownAddress === false ? 'border-yellow-400 bg-yellow-50' : 'border-black/10'
              }`}
              placeholder="0x..."
              required
            />
            {isKnownAddress === false && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500 group cursor-help">
                <AlertTriangle size={20} className="animate-pulse" />
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-black text-white text-xs p-2 rounded hidden group-hover:block font-sans z-10">
                  New wallet address - Please verify carefully
                </div>
              </div>
            )}
            {isKnownAddress === true && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                <CheckCircle2 size={20} />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="font-mono font-bold text-sm block mb-1">Amount (SUI)</label>
          <input
            type="number"
            step="0.000000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border-2 border-black/10 p-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-primary/20 transition-all rounded-lg"
            placeholder="1.0"
            required
          />
          <div className="flex items-center gap-1 mt-1 text-xs font-mono text-gray-500">
             <Zap size={12} className="text-green-500 fill-green-500" />
             <span>Estimated Gas: ~0.001 SUI</span>
             <span className="text-green-600 font-bold bg-green-100 px-1 rounded">(Sponsored)</span>
          </div>

          <div className="mt-3 border-2 border-black/10 rounded-lg p-3 bg-white/70">
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <span className="font-mono font-bold text-sm">
                🤖 Optimize with AutoAMM (AI Powered)
              </span>
              <input
                type="checkbox"
                checked={optimizeWithAutoAmm}
                onChange={(e) => setOptimizeWithAutoAmm(e.target.checked)}
                className="h-5 w-5 accent-black"
              />
            </label>

            {optimizeWithAutoAmm && (
              <div className="mt-2 text-xs font-mono">
                {autoAmmLoading && <span className="text-gray-600">Fetching strategies...</span>}
                {!autoAmmLoading && autoAmmError && <span className="text-red-600">AutoAMM unavailable: {autoAmmError}</span>}

                {!autoAmmLoading && !autoAmmError && autoAmmOptimizeResult && (
                  <div className="flex flex-col gap-2">
                    <div className="text-black">
                      Recommended: <span className="font-black uppercase">{autoAmmOptimizeResult.recommendation.protocol}</span>{' '}
                      <span className="font-black">({autoAmmOptimizeResult.recommendation.apr.toFixed(2)}% APR)</span>
                    </div>
                    {autoAmmSelected ? (
                      <div className="text-black">
                        Selected: <span className="font-black uppercase">{autoAmmSelected.protocol}</span>{' '}
                        <span className="font-black">({autoAmmSelected.apr.toFixed(2)}% APR)</span>{' '}
                        <button
                          type="button"
                          onClick={() => setAutoAmmModalOpen(true)}
                          className="ml-2 underline text-neo-secondary font-bold"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAutoAmmModalOpen(true)}
                        className="underline text-neo-secondary font-bold text-left"
                      >
                        Choose a strategy…
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="font-mono font-bold text-sm block mb-1">Execution Time</label>
          <input
            type="datetime-local"
            value={executeAt}
            onChange={(e) => setExecuteAt(e.target.value)}
            className="w-full border-2 border-black/10 p-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-primary/20 transition-all rounded-lg"
            required
          />
        </div>

        <div>
          <label className="font-mono font-bold text-sm block mb-1">Description (Metadata)</label>
          <input
            type="text"
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            className="w-full border-2 border-black/10 p-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-primary/20 transition-all rounded-lg"
            placeholder="e.g. Monthly rent"
          />
        </div>

        <div>
          <label className="font-mono font-bold text-sm block mb-1">Relayer Fee (MIST)</label>
          <input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-full border-2 border-black/10 p-3 font-mono focus:outline-none focus:ring-4 focus:ring-neo-primary/20 transition-all bg-gray-50 rounded-lg"
          />
          <p className="text-xs text-gray-500 font-mono mt-1">1 SUI = 1,000,000,000 MIST. Default 0.01 SUI.</p>
        </div>

        <NeoButton 
          type="submit" 
          variant="primary" 
          fullWidth 
          disabled={loading || !currentAccount || (optimizeWithAutoAmm && (autoAmmLoading || autoAmmSelected === null))}
          className="mt-6 rounded-lg shadow-neo-sm hover:shadow-neo"
        >
          {loading ? 'Processing...' : 'Schedule Payment'}
        </NeoButton>

        {optimizeWithAutoAmm && autoAmmSelected === null && (
          <p className="text-red-500 text-center font-mono text-sm mt-2">
            Select an AutoAMM strategy to schedule
          </p>
        )}
        
        {!currentAccount && (
          <p className="text-red-500 text-center font-mono text-sm mt-2">
            Connect wallet to schedule
          </p>
        )}
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
