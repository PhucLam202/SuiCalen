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
    <div className="bg-white border-4 border-black p-6 shadow-neo mb-6 relative overflow-hidden group hover:shadow-neo-lg transition-all">
      <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-4">
        <h3 className="font-display text-2xl font-black uppercase flex items-center gap-2">
          <Bell size={24} className="text-black fill-neo-warning" />
          Notification Hub
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`p-2 border-2 border-black transition-all shadow-neo-sm hover:-translate-y-0.5 ${emailEnabled ? 'bg-neo-primary text-white' : 'bg-white text-gray-400 hover:text-black'}`}
            title="Email Notifications"
          >
            <Mail size={18} />
          </button>
          <button
            onClick={() => setTelegramEnabled(!telegramEnabled)}
            className={`p-2 border-2 border-black transition-all shadow-neo-sm hover:-translate-y-0.5 ${telegramEnabled ? 'bg-[#229ED9] text-white' : 'bg-white text-gray-400 hover:text-black'}`}
            title="Telegram Notifications"
          >
            <MessageCircle size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {pendingTasks.length > 0 ? (
          pendingTasks.map(task => (
            <div key={task.id} className="bg-neo-bg border-2 border-black p-4 flex justify-between items-center shadow-neo-sm hover:translate-x-1 transition-transform relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/40 to-transparent pointer-events-none"></div>

              <div className="z-10 relative">
                <div className="font-display text-[9px] font-black text-gray-500 mb-1 tracking-widest uppercase">Upcoming Payment</div>
                {(() => {
                  const metaText = task.metadata ?? '';
                  const formatted = formatTaskMetadata(metaText);

                  return (
                    <div className="flex flex-col gap-1">
                      <div className="font-display font-black text-lg truncate w-full max-w-[180px] md:max-w-xs">{formatted.title}</div>
                      {formatted.badge && (
                        <div className="flex items-center gap-2">
                          <span className="bg-neo-accent text-black px-2 py-0.5 border border-black text-[10px] font-black uppercase tracking-wide flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            AutoAMM <span className="text-[8px]">⚡</span> {formatted.badge.protocol}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-4 z-10 relative">
                <div className="text-right">
                  <div className="font-mono text-xl text-black font-bold tracking-tighter bg-white px-2 border border-black shadow-[2px_2px_0px_0px_#ccc]">
                    {getCountdown(task.executeAt)}
                  </div>
                  <div className="text-[9px] font-mono font-bold text-gray-400 uppercase mt-1">Time remaining</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-black/20 flex flex-col items-center justify-center gap-2">
            <Bell size={32} className="text-gray-300" />
            <div className="font-display font-black text-gray-400 uppercase tracking-widest text-sm">
              No tasks scheduled
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
