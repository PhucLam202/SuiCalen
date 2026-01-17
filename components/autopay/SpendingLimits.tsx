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
    <div className="glass border-[1.5px] border-white/20 p-6 shadow-soft-lg rounded-xl mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display text-lg font-bold">Spending Limits</h3>
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 uppercase">
          {period}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={30}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={isWarning ? '#EF4444' : '#3B82F6'} />
                <Cell fill="#E5E7EB" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold">
            {Math.round(percentage)}%
          </div>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-gray-600">
              You've used <span className="font-bold text-black">{usedAmount.toFixed(2)}</span> / {limit} SUI
            </span>
          </div>
          
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${isWarning ? 'bg-red-500' : 'bg-neo-primary'}`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          
          {isWarning && (
            <div className="flex items-center gap-1 mt-2 text-red-500 text-xs font-bold">
              <AlertTriangle size={12} />
              <span>Approaching limit!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
