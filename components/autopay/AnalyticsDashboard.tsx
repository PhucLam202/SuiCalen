import React, { useEffect, useState } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Zap, DollarSign, Activity, Shield } from 'lucide-react';

const REGISTRY_ID = import.meta.env.VITE_REGISTRY_ID;

interface RegistryStats {
  totalCreated: number;
  totalExecuted: number;
  totalCancelled: number;
  totalFailed: number;
  totalVolume: number;
  totalFees: number;
  minRelayerFee: number;
  isPaused: boolean;
}

export const AnalyticsDashboard: React.FC = () => {
  const client = useSuiClient();
  const [stats, setStats] = useState<RegistryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!REGISTRY_ID) return;
      try {
        const obj = await client.getObject({
          id: REGISTRY_ID,
          options: { showContent: true }
        });

        if (obj.data?.content && 'fields' in obj.data.content) {
          const fields = obj.data.content.fields as Record<string, string>;
          setStats({
            totalCreated: parseInt(fields.total_tasks_created),
            totalExecuted: parseInt(fields.total_tasks_executed),
            totalCancelled: parseInt(fields.total_tasks_cancelled),
            totalFailed: parseInt(fields.total_tasks_failed),
            totalVolume: parseInt(fields.total_volume),
            totalFees: parseInt(fields.total_fees_paid || '0'),
            minRelayerFee: parseInt(fields.min_relayer_fee || '1000000'),
            isPaused: fields.is_paused === 'true',
          });
        }
      } catch (error) {
        console.error('Error fetching registry stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [client]);

  if (loading) return <div className="font-mono animate-pulse text-center p-8">Loading analytics...</div>;
  if (!stats) return null;

  const pendingCount = stats.totalCreated - (stats.totalExecuted + stats.totalCancelled + stats.totalFailed);
  const successRate = stats.totalCreated > 0 
    ? ((stats.totalExecuted / stats.totalCreated) * 100).toFixed(1) 
    : '0';
  const avgTaskSize = stats.totalCreated > 0 
    ? (stats.totalVolume / stats.totalCreated / 1e9).toFixed(4) 
    : '0';

  const pieData = [
    { name: 'Executed', value: stats.totalExecuted, color: '#22c55e' },
    { name: 'Cancelled', value: stats.totalCancelled, color: '#ef4444' },
    { name: 'Failed', value: stats.totalFailed, color: '#f59e0b' },
    { name: 'Pending', value: pendingCount, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  const barData = [
    { name: 'Volume (SUI)', value: stats.totalVolume / 1e9 },
    { name: 'Fees (SUI)', value: stats.totalFees / 1e9 },
  ];

  const performanceData = [
    { name: 'Executed', value: stats.totalExecuted },
    { name: 'Cancelled', value: stats.totalCancelled },
    { name: 'Failed', value: stats.totalFailed },
    { name: 'Pending', value: pendingCount },
  ];

  return (
    <div className="space-y-8">
      {/* System Status Alert */}
      {stats.isPaused && (
        <div className="bg-red-100 border-4 border-red-600 p-6 shadow-neo">
          <div className="flex items-center gap-4">
            <Shield size={32} className="text-red-600" />
            <div>
              <h3 className="font-display text-xl font-bold uppercase text-red-800">System Paused</h3>
              <p className="font-mono text-red-700">The autopay system is currently paused. No new tasks can be created.</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-4 border-black p-8 shadow-neo-lg w-full">
        <h2 className="font-display text-3xl font-black uppercase mb-8 border-b-4 border-black pb-2">
          Platform Analytics
        </h2>

        {/* Main Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Total Tasks" 
            value={stats.totalCreated} 
            color="bg-blue-500" 
            icon={<Activity size={24} />}
          />
          <StatCard 
            title="Total Volume" 
            value={`${(stats.totalVolume / 1e9).toFixed(2)} SUI`} 
            color="bg-purple-500"
            icon={<TrendingUp size={24} />}
          />
          <StatCard 
            title="Relayer Fees" 
            value={`${(stats.totalFees / 1e9).toFixed(4)} SUI`} 
            color="bg-green-500"
            icon={<DollarSign size={24} />}
          />
          <StatCard 
            title="Success Rate" 
            value={`${successRate}%`} 
            color="bg-orange-500"
            icon={<Zap size={24} />}
          />
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-100 border-2 border-black p-4 shadow-neo-sm">
            <div className="font-display text-sm uppercase text-gray-600">Pending Tasks</div>
            <div className="font-display text-2xl font-bold">{pendingCount}</div>
          </div>
          <div className="bg-gray-100 border-2 border-black p-4 shadow-neo-sm">
            <div className="font-display text-sm uppercase text-gray-600">Avg Task Size</div>
            <div className="font-display text-2xl font-bold">{avgTaskSize} SUI</div>
          </div>
          <div className="bg-gray-100 border-2 border-black p-4 shadow-neo-sm">
            <div className="font-display text-sm uppercase text-gray-600">Min Relayer Fee</div>
            <div className="font-display text-2xl font-bold">{(stats.minRelayerFee / 1e9).toFixed(6)} SUI</div>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="h-80 border-2 border-black p-4 bg-gray-50 shadow-neo-sm" style={{ minHeight: '320px' }}>
          <h3 className="font-display text-xl font-bold mb-4 uppercase">Task Status Distribution</h3>
          <div style={{ width: '100%', height: 'calc(100% - 2rem)' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
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
        </div>

        <div className="h-80 border-2 border-black p-4 bg-gray-50 shadow-neo-sm" style={{ minHeight: '320px' }}>
          <h3 className="font-display text-xl font-bold mb-4 uppercase">Volume vs Fees</h3>
          <div style={{ width: '100%', height: 'calc(100% - 2rem)' }}>
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" />
                <XAxis dataKey="name" stroke="#000" tick={{ fontFamily: 'monospace', fontWeight: 'bold' }} />
                <YAxis stroke="#000" tick={{ fontFamily: 'monospace' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '2px solid #000', fontFamily: 'monospace' }}
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                />
                <Bar dataKey="value" fill="#ffde00" stroke="#000" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div className="bg-white border-4 border-black p-6 shadow-neo-lg">
        <h3 className="font-display text-xl font-bold mb-4 uppercase">Task Breakdown</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={performanceData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fontFamily: 'monospace' }} />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: 'monospace', fontWeight: 'bold' }} width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '2px solid #000', fontFamily: 'monospace' }}
              />
              <Bar dataKey="value" fill="#3b82f6" stroke="#000" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  color: string;
  icon?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color, icon }) => (
  <div className={`${color} border-4 border-black p-6 shadow-neo transform hover:-translate-y-1 transition-transform`}>
    <div className="flex items-center gap-2 text-white/80 mb-1">
      {icon}
      <span className="font-display text-sm font-black uppercase">{title}</span>
    </div>
    <div className="font-display text-3xl font-black text-white">{value}</div>
  </div>
);
