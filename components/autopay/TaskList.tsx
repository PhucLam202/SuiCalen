import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { NeoButton } from '../NeoButton';
import toast from 'react-hot-toast';
import { Clock, Pause, Play, Trash2, Zap, AlertCircle } from 'lucide-react';

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

      // Filter events where sender is current user
      const myTaskEvents = events.data.filter((e: any) => e.parsedJson.sender === currentAccount.address);
      
      if (myTaskEvents.length === 0) {
        setTasks([]);
        if (onTasksLoaded) onTasksLoaded([]);
        setLoading(false);
        return;
      }

      // 2. Get Object IDs from events
      const objectIds = myTaskEvents.map((e: any) => e.parsedJson.task_id);

      // 3. Fetch objects
      const objects = await suiClient.multiGetObjects({
        ids: objectIds,
        options: { showContent: true }
      });

      // 4. Map valid objects to TaskDetails
      const activeTasks: TaskDetails[] = [];
      
      objects.forEach((obj) => {
        if (obj.data && obj.data.content) {
            const fields = (obj.data.content as any).fields;
            activeTasks.push({
                id: obj.data.objectId,
                sender: fields.sender,
                recipient: fields.recipient,
                balance: parseInt(fields.balance),
                execute_at: parseInt(fields.execute_at),
                status: fields.status,
                created_at: parseInt(fields.created_at),
                metadata: new TextDecoder().decode(new Uint8Array(fields.metadata))
            });
        }
      });

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
          toast.success('Task cancelled successfully', {
            icon: '🚫',
          });
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
          <br/>
          <span className="text-xs">This feature requires a smart contract update. Coming in v2.</span>
          <button onClick={() => toast.dismiss(t.id)} className="ml-2 bg-gray-200 px-2 rounded">Dismiss</button>
        </span>
    ), { icon: '⏸️' });
  };

  if (!currentAccount) {
    return (
        <div className="glass border-[1.5px] border-black/10 p-8 shadow-soft-lg w-full text-center rounded-xl">
            <p className="font-mono text-lg">Connect wallet to view your tasks</p>
        </div>
    );
  }

  return (
    <div className="glass border-[1.5px] border-black/10 p-8 shadow-soft-lg w-full rounded-xl">
      <div className="flex justify-between items-center mb-6 border-b-2 border-black/10 pb-2">
        <h2 className="font-display text-2xl font-black uppercase">
            Your Scheduled Tasks
        </h2>
        <button onClick={fetchTasks} className="text-sm font-mono underline hover:text-neo-primary">
            Refresh
        </button>
      </div>
      
      {loading && tasks.length === 0 ? (
        <div className="text-center font-mono animate-pulse">Loading tasks from chain...</div>
      ) : (
        <div className="space-y-4">
            {tasks.length === 0 ? (
                <div className="text-center py-8">
                    <p className="font-mono text-gray-500 mb-2">No active tasks found.</p>
                </div>
            ) : (
                tasks.map((task) => {
                    const isReady = new Date(task.execute_at) <= new Date();
                    
                    return (
                        <div key={task.id} className="bg-white/50 border border-white/40 p-5 rounded-lg shadow-sm hover:shadow-md hover:border-neo-primary/30 transition-all duration-300 relative group overflow-hidden">
                            {/* Gradient Border on Hover */}
                            <div className="absolute inset-0 border-2 border-transparent group-hover:border-neo-primary/20 rounded-lg pointer-events-none transition-all"></div>
                            
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg">{task.metadata || 'Payment'}</h3>
                                        {task.status === 0 ? (
                                            <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-200 uppercase tracking-wide">
                                                Pending
                                            </span>
                                        ) : (
                                            <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-gray-200 uppercase tracking-wide">
                                                Processed
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 font-mono text-xs text-gray-500">
                                        <span className="truncate max-w-[120px]" title={task.recipient}>
                                            To: {task.recipient.slice(0, 6)}...{task.recipient.slice(-4)}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-display font-black text-xl">{(task.balance / 1e9).toFixed(2)} SUI</div>
                                    <div className="font-mono text-[10px] text-gray-400">Amount</div>
                                </div>
                            </div>

                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2 text-sm font-mono">
                                    <Clock size={16} className={isReady ? "text-neo-primary animate-pulse" : "text-gray-400"} />
                                    <span>
                                        {new Date(task.execute_at).toLocaleString()}
                                    </span>
                                    {isReady && (
                                        <span className="text-neo-primary font-bold text-xs bg-neo-primary/10 px-2 py-0.5 rounded">
                                            READY
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {isReady && (
                                        <button 
                                            onClick={() => handleExecute(task.id)}
                                            className="p-2 bg-neo-primary text-white rounded-lg hover:bg-neo-primary/90 transition-colors shadow-sm"
                                            title="Execute Task"
                                        >
                                            <Zap size={18} fill="currentColor" />
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={() => handlePause(task.id)}
                                        className="p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:text-white hover:border-transparent hover:bg-gradient-to-r hover:from-neo-primary hover:to-neo-secondary transition-all shadow-sm group/pause"
                                        title="Pause Task"
                                    >
                                        <Pause size={18} fill="currentColor" />
                                    </button>

                                    <button 
                                        onClick={() => handleCancel(task.id)}
                                        className="p-2 bg-white border border-gray-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
                                        title="Cancel Task"
                                    >
                                        <Trash2 size={18} />
                                    </button>
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
