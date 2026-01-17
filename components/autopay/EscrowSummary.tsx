import React, { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Lock, Unlock, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

const PACKAGE_ID = import.meta.env.VITE_AUTOPAY_PACKAGE_ID;

interface EscrowTask {
  id: string;
  balance: number;
  relayerFee: number;
  executeAt: number;
  status: number;
  recipient: string;
  isReady: boolean;
}

interface EscrowStats {
  totalLocked: number;
  pendingCount: number;
  readyCount: number;
  tasks: EscrowTask[];
}

export const EscrowSummary: React.FC = () => {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [escrowStats, setEscrowStats] = useState<EscrowStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEscrowData = useCallback(async () => {
    if (!account || !PACKAGE_ID) return;
    setLoading(true);

    try {
      // Query TaskCreated events for user
      const events = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::autopay::TaskCreated` },
        limit: 100,
        order: 'descending',
      });

      // Filter by sender
      const userEvents = events.data.filter(
        (e: { parsedJson: { sender?: string } }) => e.parsedJson?.sender === account.address
      );

      if (userEvents.length === 0) {
        setEscrowStats({ totalLocked: 0, pendingCount: 0, readyCount: 0, tasks: [] });
        setLoading(false);
        return;
      }

      // Get task objects
      const taskIds = userEvents.map((e: { parsedJson: { task_id?: string } }) => e.parsedJson?.task_id).filter(Boolean) as string[];
      
      const objects = await client.multiGetObjects({
        ids: taskIds,
        options: { showContent: true }
      });

      const now = Date.now();
      const tasks: EscrowTask[] = [];
      let totalLocked = 0;
      let pendingCount = 0;
      let readyCount = 0;

      objects.forEach((obj) => {
        if (obj.data && obj.data.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as {
            status?: number;
            balance?: string;
            relayer_fee?: string;
            execute_at?: string;
            recipient?: string;
          };
          
          // Only count pending tasks (status === 0)
          if (fields.status === 0) {
            const balance = parseInt(fields.balance || '0');
            const relayerFee = parseInt(fields.relayer_fee || '0');
            const executeAt = parseInt(fields.execute_at || '0');
            const isReady = now >= executeAt;

            tasks.push({
              id: obj.data.objectId,
              balance,
              relayerFee,
              executeAt,
              status: fields.status,
              recipient: fields.recipient || '',
              isReady,
            });

            totalLocked += balance + relayerFee;
            pendingCount++;
            if (isReady) readyCount++;
          }
        }
      });

      // Sort by execute time
      tasks.sort((a, b) => a.executeAt - b.executeAt);

      setEscrowStats({ totalLocked, pendingCount, readyCount, tasks });
    } catch (error) {
      console.error('Error fetching escrow data:', error);
    } finally {
      setLoading(false);
    }
  }, [account, client]);

  useEffect(() => {
    fetchEscrowData();
    const interval = setInterval(fetchEscrowData, 15000);
    return () => clearInterval(interval);
  }, [fetchEscrowData]);

  if (!account) {
    return (
      <div className="bg-white border-4 border-black p-8 shadow-neo-lg w-full text-center">
        <Lock className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="font-mono text-lg">Connect your wallet to view escrowed funds</p>
      </div>
    );
  }

  if (loading && !escrowStats) {
    return <div className="font-mono animate-pulse text-center p-8">Loading escrow data...</div>;
  }

  if (!escrowStats) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-500 border-4 border-black p-6 shadow-neo">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <Lock size={24} />
            <span className="font-display text-sm font-bold uppercase">Total Locked</span>
          </div>
          <div className="font-display text-3xl font-black text-white">
            {(escrowStats.totalLocked / 1e9).toFixed(4)} SUI
          </div>
        </div>

        <div className="bg-yellow-500 border-4 border-black p-6 shadow-neo">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <Clock size={24} />
            <span className="font-display text-sm font-bold uppercase">Pending Tasks</span>
          </div>
          <div className="font-display text-3xl font-black text-white">
            {escrowStats.pendingCount}
          </div>
        </div>

        <div className="bg-green-500 border-4 border-black p-6 shadow-neo">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <CheckCircle size={24} />
            <span className="font-display text-sm font-bold uppercase">Ready to Execute</span>
          </div>
          <div className="font-display text-3xl font-black text-white">
            {escrowStats.readyCount}
          </div>
        </div>
      </div>

      {/* Ready Tasks Alert */}
      {escrowStats.readyCount > 0 && (
        <div className="bg-green-100 border-4 border-green-600 p-6 shadow-neo">
          <div className="flex items-center gap-4">
            <AlertTriangle size={32} className="text-green-600" />
            <div>
              <h3 className="font-display text-xl font-bold uppercase text-green-800">
                {escrowStats.readyCount} Task(s) Ready for Execution
              </h3>
              <p className="font-mono text-green-700">
                These tasks have reached their execution time and can be executed by the relayer or manually.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Escrow Tasks List */}
      {escrowStats.tasks.length > 0 && (
        <div className="bg-white border-4 border-black p-6 shadow-neo-lg">
          <h3 className="font-display text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2">
            Escrowed Funds Breakdown
          </h3>
          
          <div className="space-y-4">
            {escrowStats.tasks.map((task) => (
              <div 
                key={task.id} 
                className={`border-2 border-black p-4 ${task.isReady ? 'bg-green-50' : 'bg-gray-50'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {task.isReady ? (
                      <Unlock size={20} className="text-green-600" />
                    ) : (
                      <Lock size={20} className="text-gray-600" />
                    )}
                    <span className="font-mono text-sm">
                      {task.id.slice(0, 8)}...{task.id.slice(-6)}
                    </span>
                  </div>
                  <span className={`font-mono text-xs px-2 py-1 border ${
                    task.isReady 
                      ? 'bg-green-200 border-green-600 text-green-800' 
                      : 'bg-yellow-200 border-yellow-600 text-yellow-800'
                  }`}>
                    {task.isReady ? 'READY' : 'PENDING'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm">
                  <div>
                    <span className="text-gray-500">Amount:</span>
                    <p className="font-bold">{(task.balance / 1e9).toFixed(4)} SUI</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Fee:</span>
                    <p className="font-bold">{(task.relayerFee / 1e9).toFixed(6)} SUI</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Locked:</span>
                    <p className="font-bold text-blue-600">{((task.balance + task.relayerFee) / 1e9).toFixed(4)} SUI</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Execute At:</span>
                    <p className="font-bold">{new Date(task.executeAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-2 font-mono text-xs text-gray-500">
                  Recipient: {task.recipient.slice(0, 10)}...{task.recipient.slice(-8)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {escrowStats.tasks.length === 0 && (
        <div className="bg-white border-4 border-black p-8 shadow-neo-lg text-center">
          <Unlock className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="font-mono text-gray-500">No funds currently escrowed</p>
          <p className="font-mono text-sm text-gray-400 mt-2">
            Create a scheduled payment to escrow funds
          </p>
        </div>
      )}
    </div>
  );
};
