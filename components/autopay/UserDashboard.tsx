import React, { useEffect, useState, useCallback } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Wallet, Clock, CheckCircle, XCircle, TrendingUp, Coins, AlertTriangle } from 'lucide-react';

const PACKAGE_ID = import.meta.env.VITE_AUTOPAY_PACKAGE_ID;

interface UserStats {
  totalTasks: number;
  pendingTasks: number;
  executedTasks: number;
  cancelledTasks: number;
  failedTasks: number;
  totalVolume: number;
  totalFeesPaid: number;
  totalLockedFunds: number;
}

interface TaskEvent {
  type: string;
  timestamp: number;
  amount: number;
  relayerFeePaid?: number;
}

export const UserDashboard: React.FC = () => {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserStats = useCallback(async () => {
    if (!account || !PACKAGE_ID) return;
    setLoading(true);

    try {
      // Query all events related to the user
      const [createdEvents, executedEvents, cancelledEvents, failedEvents] = await Promise.all([
        client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::autopay::TaskCreated` },
          limit: 100,
          order: 'descending',
        }),
        client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::autopay::TaskExecuted` },
          limit: 100,
          order: 'descending',
        }),
        client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::autopay::TaskCancelled` },
          limit: 100,
          order: 'descending',
        }),
        client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::autopay::TaskFailed` },
          limit: 100,
          order: 'descending',
        }),
      ]);

      // Filter events by user address
      const userCreated = createdEvents.data.filter(
        (e: { parsedJson: { sender?: string } }) => e.parsedJson?.sender === account.address
      );
      const userExecuted = executedEvents.data.filter(
        (e: { parsedJson: { executor?: string } }) => e.parsedJson?.executor === account.address
      );
      const userCancelled = cancelledEvents.data.filter(
        (e: { parsedJson: { sender?: string } }) => e.parsedJson?.sender === account.address
      );
      const userFailed = failedEvents.data.filter(
        (e: { parsedJson: { executor?: string } }) => e.parsedJson?.executor === account.address
      );

      // Calculate stats
      let totalVolume = 0;
      let totalFeesPaid = 0;

      userCreated.forEach((e: { parsedJson: { amount?: string | number } }) => {
        totalVolume += parseInt(String(e.parsedJson?.amount || 0));
      });

      userExecuted.forEach((e: { parsedJson: { relayer_fee_paid?: string | number } }) => {
        totalFeesPaid += parseInt(String(e.parsedJson?.relayer_fee_paid || 0));
      });

      // Get pending tasks (tasks that exist on-chain)
      const taskIds = userCreated.map((e: { parsedJson: { task_id?: string } }) => e.parsedJson?.task_id).filter(Boolean) as string[];
      let pendingCount = 0;
      let lockedFunds = 0;

      if (taskIds.length > 0) {
        const objects = await client.multiGetObjects({
          ids: taskIds,
          options: { showContent: true }
        });

        objects.forEach((obj) => {
          if (obj.data && obj.data.content && 'fields' in obj.data.content) {
            const fields = obj.data.content.fields as { status?: number; balance?: string; relayer_fee?: string };
            if (fields.status === 0) {
              pendingCount++;
              lockedFunds += parseInt(fields.balance || '0') + parseInt(fields.relayer_fee || '0');
            }
          }
        });
      }

      setStats({
        totalTasks: userCreated.length,
        pendingTasks: pendingCount,
        executedTasks: userExecuted.length,
        cancelledTasks: userCancelled.length,
        failedTasks: userFailed.length,
        totalVolume,
        totalFeesPaid,
        totalLockedFunds: lockedFunds,
      });

      // Build recent activity timeline
      interface RawEvent {
        type: string;
        timestampMs: string;
        parsedJson: { amount?: string | number; relayer_fee_paid?: string | number };
      }
      const allEvents: RawEvent[] = [
        ...userCreated.map((e: RawEvent) => ({ ...e, type: 'created' })),
        ...userExecuted.map((e: RawEvent) => ({ ...e, type: 'executed' })),
        ...userCancelled.map((e: RawEvent) => ({ ...e, type: 'cancelled' })),
      ].sort((a, b) => parseInt(b.timestampMs) - parseInt(a.timestampMs)).slice(0, 10);

      setRecentActivity(allEvents.map((e) => ({
        type: e.type,
        timestamp: parseInt(e.timestampMs),
        amount: parseInt(String(e.parsedJson?.amount || 0)),
        relayerFeePaid: parseInt(String(e.parsedJson?.relayer_fee_paid || 0)),
      })));

    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  }, [account, client]);

  useEffect(() => {
    fetchUserStats();
    const interval = setInterval(fetchUserStats, 30000);
    return () => clearInterval(interval);
  }, [fetchUserStats]);

  if (!account) {
    return (
      <div className="bg-white border-4 border-black p-8 shadow-neo-lg w-full text-center">
        <Wallet className="mx-auto mb-4" size={48} />
        <p className="font-mono text-lg">Connect your wallet to view your dashboard</p>
      </div>
    );
  }

  if (loading && !stats) {
    return <div className="font-mono animate-pulse text-center p-8">Loading your dashboard...</div>;
  }

  if (!stats) return null;

  const pieData = [
    { name: 'Pending', value: stats.pendingTasks, color: '#3b82f6' },
    { name: 'Executed', value: stats.executedTasks, color: '#22c55e' },
    { name: 'Cancelled', value: stats.cancelledTasks, color: '#ef4444' },
    { name: 'Failed', value: stats.failedTasks, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Build activity chart data (last 7 days)
  const activityData = buildActivityChartData(recentActivity);

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Tasks"
          value={stats.totalTasks}
          icon={<Clock size={24} />}
          color="bg-blue-500"
        />
        <StatCard
          title="Pending"
          value={stats.pendingTasks}
          icon={<AlertTriangle size={24} />}
          color="bg-yellow-500"
          subtitle={`${(stats.totalLockedFunds / 1e9).toFixed(4)} SUI locked`}
        />
        <StatCard
          title="Executed"
          value={stats.executedTasks}
          icon={<CheckCircle size={24} />}
          color="bg-green-500"
        />
        <StatCard
          title="Total Volume"
          value={`${(stats.totalVolume / 1e9).toFixed(2)} SUI`}
          icon={<Coins size={24} />}
          color="bg-purple-500"
        />
      </div>

      {/* Locked Funds Alert */}
      {stats.totalLockedFunds > 0 && (
        <div className="bg-yellow-100 border-4 border-yellow-600 p-6 shadow-neo">
          <div className="flex items-center gap-4">
            <AlertTriangle size={32} className="text-yellow-600" />
            <div>
              <h3 className="font-display text-xl font-bold uppercase">Escrowed Funds</h3>
              <p className="font-mono">
                You have <span className="font-bold text-yellow-800">{(stats.totalLockedFunds / 1e9).toFixed(4)} SUI</span> locked in {stats.pendingTasks} pending task(s).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Task Status Pie Chart */}
        <div className="bg-white border-4 border-black p-6 shadow-neo-lg">
          <h3 className="font-display text-xl font-bold uppercase mb-4">Task Status Distribution</h3>
          {pieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#000" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '2px solid #000', fontFamily: 'monospace' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 font-mono">
              No tasks yet
            </div>
          )}
        </div>

        {/* Activity Line Chart */}
        <div className="bg-white border-4 border-black p-6 shadow-neo-lg">
          <h3 className="font-display text-xl font-bold uppercase mb-4">Recent Activity</h3>
          {activityData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontFamily: 'monospace', fontSize: 12 }} />
                  <YAxis tick={{ fontFamily: 'monospace', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '2px solid #000', fontFamily: 'monospace' }}
                  />
                  <Line type="monotone" dataKey="tasks" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 font-mono">
              No recent activity
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="bg-white border-4 border-black p-6 shadow-neo-lg">
        <h3 className="font-display text-xl font-bold uppercase mb-4">Recent Transactions</h3>
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity, idx) => (
              <div key={idx} className="flex items-center gap-4 p-3 border-2 border-black bg-gray-50">
                <div className={`w-10 h-10 flex items-center justify-center border-2 border-black ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-grow">
                  <p className="font-mono font-bold capitalize">{activity.type}</p>
                  <p className="font-mono text-sm text-gray-600">
                    {(activity.amount / 1e9).toFixed(4)} SUI
                    {activity.relayerFeePaid ? ` (Fee: ${(activity.relayerFeePaid / 1e9).toFixed(6)} SUI)` : ''}
                  </p>
                </div>
                <div className="font-mono text-xs text-gray-500">
                  {new Date(activity.timestamp).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-gray-500 text-center py-8">No recent activity</p>
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }) => (
  <div className={`${color} border-4 border-black p-6 shadow-neo transform hover:-translate-y-1 transition-transform`}>
    <div className="flex items-center gap-3 text-white mb-2">
      {icon}
      <span className="font-display text-sm font-bold uppercase opacity-80">{title}</span>
    </div>
    <div className="font-display text-3xl font-black text-white">{value}</div>
    {subtitle && <div className="font-mono text-sm text-white/70 mt-1">{subtitle}</div>}
  </div>
);

const getActivityColor = (type: string): string => {
  switch (type) {
    case 'created': return 'bg-blue-400';
    case 'executed': return 'bg-green-400';
    case 'cancelled': return 'bg-red-400';
    default: return 'bg-gray-400';
  }
};

const getActivityIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'created': return <Clock size={20} />;
    case 'executed': return <CheckCircle size={20} />;
    case 'cancelled': return <XCircle size={20} />;
    default: return <TrendingUp size={20} />;
  }
};

const buildActivityChartData = (activities: TaskEvent[]): { date: string; tasks: number }[] => {
  const dateMap: Record<string, number> = {};
  
  activities.forEach(a => {
    const date = new Date(a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dateMap[date] = (dateMap[date] || 0) + 1;
  });

  return Object.entries(dateMap)
    .map(([date, tasks]) => ({ date, tasks }))
    .reverse();
};
