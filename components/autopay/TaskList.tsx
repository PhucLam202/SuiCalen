import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import toast from 'react-hot-toast';
import { Clock, Pause, Play, Trash2, Zap, ArrowRight, Wallet } from 'lucide-react';
import type { SuiEvent, SuiObjectResponse } from '@mysten/sui/client';
import { formatTaskMetadata } from '../../services/autoAmmMetadata';

const PACKAGE_ID = import.meta.env.VITE_AUTOPAY_PACKAGE_ID;
const REGISTRY_ID = import.meta.env.VITE_REGISTRY_ID;

export interface TaskDetails {
  id: string;
  sender: string;
  recipient: string;
  balance: number;
  execute_at: number;
  status: number;
  created_at: number;
  metadata: string;
}

interface TaskListProps {
  onTasksLoaded?: (tasks: TaskDetails[]) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ onTasksLoaded }) => {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [tasks, setTasks] = useState<TaskDetails[]>([]);
  const [loading, setLoading] = useState(false);

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  function parseTaskCreatedEvent(event: SuiEvent): { taskId: string; sender: string } | null {
    const parsed: unknown = event.parsedJson;
    if (!isRecord(parsed)) return null;
    const taskId = parsed.task_id;
    const sender = parsed.sender;
    if (typeof taskId !== 'string' || !taskId.startsWith('0x')) return null;
    if (typeof sender !== 'string' || !sender.startsWith('0x')) return null;
    return { taskId, sender };
  }

  function decodeMetadata(raw: unknown): string {
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw) && raw.every((x: unknown) => typeof x === 'number')) {
      return new TextDecoder().decode(Uint8Array.from(raw));
    }
    if (raw && typeof raw === 'object') {
      const rec = raw as Record<string, unknown>;
      const bytes = rec.bytes;
      if (typeof bytes === 'string') return bytes;
    }
    return '';
  }

  function parseTaskObject(obj: SuiObjectResponse): TaskDetails | null {
    const objectId = obj.data?.objectId;
    const content = obj.data?.content;
    if (!objectId || !content || content.dataType !== 'moveObject') {
      return null;
    }

    const fields = content.fields as unknown;
    if (!isRecord(fields)) return null;

    const sender = fields.sender;
    const recipient = fields.recipient;
    const balanceRaw = fields.balance;
    const executeAtRaw = fields.execute_at;
    const statusRaw = fields.status;
    const createdAtRaw = fields.created_at;
    const metadataRaw = fields.metadata;

    if (typeof sender !== 'string') return null;
    if (typeof recipient !== 'string') return null;

    const balance = typeof balanceRaw === 'string' ? Number.parseInt(balanceRaw, 10) : typeof balanceRaw === 'number' ? balanceRaw : Number.NaN;
    const execute_at = typeof executeAtRaw === 'string' ? Number.parseInt(executeAtRaw, 10) : typeof executeAtRaw === 'number' ? executeAtRaw : Number.NaN;
    const created_at = typeof createdAtRaw === 'string' ? Number.parseInt(createdAtRaw, 10) : typeof createdAtRaw === 'number' ? createdAtRaw : Number.NaN;
    const status = typeof statusRaw === 'string' ? Number.parseInt(statusRaw, 10) : typeof statusRaw === 'number' ? statusRaw : Number.NaN;

    if (!Number.isFinite(balance) || !Number.isFinite(execute_at) || !Number.isFinite(created_at) || !Number.isFinite(status)) {
      return null;
    }

    return {
      id: objectId,
      sender,
      recipient,
      balance,
      execute_at,
      status,
      created_at,
      metadata: decodeMetadata(metadataRaw),
    };
  }

  const fetchTasks = async () => {
    if (!currentAccount || !PACKAGE_ID) return;
    setLoading(true);

    try {
      // 1. Query 'TaskCreated' events filtered by sender
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::autopay::TaskCreated`
        },
        limit: 50,
        order: 'descending'
      });

      const parsedEvents = events.data
        .map((e: SuiEvent) => parseTaskCreatedEvent(e))
        .filter((x): x is { taskId: string; sender: string } => x !== null);

      // Filter events where sender is current user
      const myTaskEvents = parsedEvents.filter((e) => e.sender === currentAccount.address);

      if (myTaskEvents.length === 0) {
        setTasks([]);
        if (onTasksLoaded) onTasksLoaded([]);
        setLoading(false);
        return;
      }

      // 2. Get Object IDs from events
      const objectIds = myTaskEvents.map((e) => e.taskId);

      // 3. Fetch objects
      const objects = await suiClient.multiGetObjects({
        ids: objectIds,
        options: { showContent: true }
      });

      // 4. Map valid objects to TaskDetails
      const activeTasks: TaskDetails[] = objects
        .map((obj: SuiObjectResponse) => parseTaskObject(obj))
        .filter((t): t is TaskDetails => t !== null);

      setTasks(activeTasks);
      if (onTasksLoaded) onTasksLoaded(activeTasks);

    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Poll every 10 seconds
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [currentAccount]);

  const handleCancel = (taskId: string) => {
    if (!PACKAGE_ID || !REGISTRY_ID) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::autopay::cancel_task`,
      arguments: [
        tx.object(taskId),
        tx.object(REGISTRY_ID),
        tx.object('0x6') // Clock
      ],
    });

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: () => {
          toast.success('Task cancelled successfully', { icon: '🚫' });
          fetchTasks(); // Refresh list
        },
        onError: (err) => {
          toast.error('Failed to cancel task: ' + err.message);
        },
      }
    );
  };

  const handleExecute = (taskId: string) => {
    if (!PACKAGE_ID || !REGISTRY_ID) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::autopay::execute_task`,
      arguments: [
        tx.object(taskId),
        tx.object(REGISTRY_ID),
        tx.object('0x6') // Clock
      ],
    });

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: () => {
          toast.success('Task executed successfully! Money transferred.', {
            icon: '💸',
            duration: 5000,
          });
          fetchTasks(); // Refresh list
        },
        onError: (err) => {
          toast.error('Failed to execute task: ' + err.message);
        },
      }
    );
  };

  const handlePause = (taskId: string) => {
    toast((t) => (
      <span>
        <b>Pause Scheduled Payment?</b>
        <br />
        <span className="text-xs">This feature requires a smart contract update. Coming in v2.</span>
        <button onClick={() => toast.dismiss(t.id)} className="ml-2 bg-gray-200 px-2 rounded">Dismiss</button>
      </span>
    ), { icon: '⏸️' });
  };

  if (!currentAccount) {
    return (
      <div className="bg-white border-4 border-black p-12 text-center shadow-neo">
        <div className="inline-block p-4 bg-neo-bg border-4 border-black rounded-full mb-4">
          <Wallet size={32} />
        </div>
        <h3 className="font-display font-black text-2xl uppercase mb-2">Wallet Not Connected</h3>
        <p className="font-mono text-gray-500">Connect your Sui wallet to view your scheduled tasks</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-4 border-black p-8 shadow-neo-lg relative">
      <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
        <h2 className="font-display text-4xl font-black uppercase">
          Scheduled Tasks
        </h2>
        <button onClick={fetchTasks} className="bg-white border-2 border-black px-4 py-2 font-display font-bold uppercase text-xs hover:bg-black hover:text-white transition-all shadow-neo-sm active:translate-y-0.5 active:shadow-none">
          Refresh List
        </button>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="font-display font-black uppercase animate-pulse">Loading tasks...</div>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 border-2 border-dashed border-black/20">
              <p className="font-display font-black text-gray-400 uppercase tracking-widest text-lg">No active tasks found</p>
              <p className="font-mono text-gray-400 text-xs mt-2">Schedule your first payment above</p>
            </div>
          ) : (
            tasks.map((task) => {
              const isReady = new Date(task.execute_at) <= new Date();
              const formatted = formatTaskMetadata(task.metadata);

              return (
                <div key={task.id} className="bg-white border-2 border-black p-0 shadow-neo-sm hover:translate-x-1 transition-all group overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Left Status Bar */}
                    <div className={`w-full md:w-2 h-2 md:h-auto ${task.status === 0 ? 'bg-neo-warning' : 'bg-gray-300'}`}></div>

                    <div className="p-6 flex-1">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-display font-black text-2xl uppercase tracking-tight">{formatted.title}</h3>
                            {task.status === 0 ? (
                              <span className="bg-neo-warning text-black px-2 py-0.5 border border-black text-[10px] font-black uppercase">
                                Pending
                              </span>
                            ) : (
                              <span className="bg-gray-200 text-gray-500 px-2 py-0.5 border border-gray-400 text-[10px] font-black uppercase">
                                Processed
                              </span>
                            )}
                            {formatted.badge && (
                              <span className="bg-neo-accent text-black px-2 py-0.5 border border-black text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                AutoAMM: {formatted.badge.protocol}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 font-mono text-xs text-gray-500 bg-gray-50 px-2 py-1 border border-gray-200 w-fit">
                            <span>To:</span>
                            <span className="font-bold text-black" title={task.recipient}>
                              {task.recipient.slice(0, 6)}...{task.recipient.slice(-4)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right bg-neo-bg p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          <div className="font-display font-black text-3xl">{(task.balance / 1e9).toFixed(2)} <span className="text-sm text-gray-500">SUI</span></div>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-t-2 border-gray-100 pt-4 mt-2">
                        <div className="flex items-center gap-2 text-sm font-mono font-bold">
                          <Clock size={18} className={isReady ? "text-neo-primary animate-pulse" : "text-gray-400"} />
                          <span>
                            {new Date(task.execute_at).toLocaleString()}
                          </span>
                          {isReady && (
                            <span className="text-neo-primary bg-neo-primary/10 px-2 py-0.5 border border-neo-primary text-[10px] uppercase tracking-widest animate-pulse">
                              Ready for Execution
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3">
                          {isReady && (
                            <button
                              onClick={() => handleExecute(task.id)}
                              className="px-4 py-2 bg-neo-primary text-white border-2 border-black font-display font-bold uppercase text-xs flex items-center gap-2 hover:bg-black transition-all shadow-neo-sm active:translate-y-0.5 active:shadow-none"
                              title="Execute Task"
                            >
                              Execute <Zap size={16} fill="currentColor" />
                            </button>
                          )}

                          <button
                            onClick={() => handlePause(task.id)}
                            className="px-4 py-2 bg-white text-black border-2 border-black font-display font-bold uppercase text-xs hover:bg-gray-100 transition-all shadow-neo-sm active:translate-y-0.5 active:shadow-none"
                            title="Pause Task"
                          >
                            Pause
                          </button>

                          <button
                            onClick={() => handleCancel(task.id)}
                            className="px-3 py-2 bg-white text-red-500 border-2 border-black hover:bg-red-50 transition-all shadow-neo-sm active:translate-y-0.5 active:shadow-none"
                            title="Cancel Task"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
