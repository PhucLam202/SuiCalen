import React, { useEffect, useState } from 'react';
import { Bell, Clock, Mail, MessageCircle } from 'lucide-react';
import { formatTaskMetadata } from '../../services/autoAmmMetadata';

interface Task {
  id: string;
  recipient: string;
  amount: number;
  executeAt: number;
  metadata?: string;
}

interface NotificationHubProps {
  tasks: Task[];
}

export const NotificationHub: React.FC<NotificationHubProps> = ({ tasks }) => {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingTasks = tasks.filter(t => t.executeAt > now).sort((a, b) => a.executeAt - b.executeAt).slice(0, 3);

  const getCountdown = (target: number) => {
    const diff = target - now;
    if (diff <= 0) return "Ready";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass border-[1.5px] border-white/20 p-6 shadow-soft-lg rounded-xl mb-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-neo-primary/10 rounded-full blur-3xl -z-10"></div>
      
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Bell size={20} className="text-neo-secondary" />
          Notification Hub
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`p-2 rounded-full border transition-all ${emailEnabled ? 'bg-neo-primary text-white border-neo-primary' : 'bg-white text-gray-400 border-gray-200'}`}
          >
            <Mail size={16} />
          </button>
          <button 
            onClick={() => setTelegramEnabled(!telegramEnabled)}
            className={`p-2 rounded-full border transition-all ${telegramEnabled ? 'bg-blue-400 text-white border-blue-400' : 'bg-white text-gray-400 border-gray-200'}`}
          >
            <MessageCircle size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {pendingTasks.length > 0 ? (
          pendingTasks.map(task => (
            <div key={task.id} className="bg-white/50 border border-white/40 p-3 rounded-lg flex justify-between items-center shadow-sm">
              <div>
                <div className="font-mono text-xs font-bold text-gray-500 mb-1">UPCOMING TASK</div>
                {(() => {
                  const metaText = task.metadata ?? '';
                  const formatted = formatTaskMetadata(metaText);
                  const maybeLegacyAutoAmm = metaText.includes('"autoAmm":true');
                  return (
                    <div className="flex flex-col gap-1">
                      <div className="font-bold text-sm truncate w-40">{formatted.title}</div>
                      {formatted.badge && (
                        <div className="flex items-center gap-2">
                          <span className="bg-neo-primary/10 text-neo-secondary px-2 py-0.5 rounded-full text-[10px] font-bold border border-neo-primary/20 uppercase tracking-wide">
                            {formatted.badge.label} → {formatted.badge.protocol} ({formatted.badge.apr.toFixed(2)}% APR)
                          </span>
                        </div>
                      )}
                      {!formatted.badge && maybeLegacyAutoAmm && (
                        <div className="text-[10px] font-mono text-yellow-700">AutoAMM enabled but no strategy selected</div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="font-mono text-xs text-neo-secondary font-bold">
                    {getCountdown(task.executeAt)}
                  </div>
                  <div className="text-[10px] text-gray-400">Time remaining</div>
                </div>
                <Clock size={16} className="text-neo-primary animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-400 font-mono text-sm">
            No upcoming tasks scheduled
          </div>
        )}
      </div>
    </div>
  );
};
