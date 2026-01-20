import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface SpendingLimitsProps {
  usedAmount: number; // in SUI
  limit: number;      // in SUI
  period: 'daily' | 'weekly';
}

export const SpendingLimits: React.FC<SpendingLimitsProps> = ({ usedAmount, limit, period }) => {
  const percentage = Math.min((usedAmount / limit) * 100, 100);
  const isWarning = percentage >= 80;

  const data = [
    { name: 'Used', value: usedAmount },
    { name: 'Remaining', value: Math.max(limit - usedAmount, 0) }
  ];

  return (
    <div className="bg-white border-4 border-black p-6 shadow-neo hover:shadow-neo-lg transition-all rounded-none mb-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-display text-lg font-black uppercase">Spending Limits</h3>
        <span className="text-[10px] font-black font-display bg-black text-white px-2 py-1 uppercase tracking-widest">
          {period}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="w-20 h-20 relative flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={40}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="black"
                strokeWidth={2}
              >
                <Cell fill={isWarning ? '#EF4444' : '#000000'} />
                <Cell fill="#F3F4F6" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold">
            {Math.round(percentage)}%
          </div>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Used Amount
            </span>
            <span className="font-mono text-sm">
              <span className="font-black text-lg">{usedAmount.toFixed(2)}</span> / {limit} SUI
            </span>
          </div>

          <div className="w-full h-4 bg-gray-100 border-2 border-black overflow-hidden relative">
            <div
              className={`h-full transition-all duration-1000 border-r-2 border-black ${isWarning ? 'bg-red-500' : 'bg-neo-primary'}`}
              style={{ width: `${percentage}%` }}
            >
              {/* Stripe pattern overlay */}
              <div className="absolute inset-0 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg,rgba(0,0,0,.1) 25%,transparent 25%,transparent 50%,rgba(0,0,0,.1) 50%,rgba(0,0,0,.1) 75%,transparent 75%,transparent)', backgroundSize: '10px 10px' }}></div>
            </div>
          </div>

          {isWarning && (
            <div className="flex items-center gap-1 mt-2 text-red-600 text-[10px] font-black uppercase animate-pulse">
              <AlertTriangle size={12} strokeWidth={3} />
              <span>Approaching limit!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
