import React, { useState, useMemo } from 'react';
import { CreateTaskForm } from './CreateTaskForm';
import { TaskList, TaskDetails } from './TaskList';
import { CalendarView } from './CalendarView';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { TaskHistory } from './TaskHistory';
import { UserDashboard } from './UserDashboard';
import { EscrowSummary } from './EscrowSummary';
import { NotificationHub } from './NotificationHub';
import { SpendingLimits } from './SpendingLimits';
import { Toaster } from 'react-hot-toast';
import { Calendar, History, BarChart3, Lock, User, TrendingUp } from 'lucide-react';
import { YieldRatesPanel } from '../yield/YieldRatesPanel';

export const AutopayDashboard: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'scheduler' | 'dashboard' | 'escrow' | 'history' | 'analytics' | 'yield'>('scheduler');
  const [tasks, setTasks] = useState<TaskDetails[]>([]);

  // Calculate spending limits stats
  const spendingStats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Calculate total scheduled/spent for today
    // Include PENDING tasks (scheduled) and EXECUTED tasks (spent) created or executed today
    // For simplicity, we just sum up pending tasks scheduled for execution today + executed tasks
    // But since we only have basic TaskDetails which are pending tasks mostly, let's just sum pending tasks for today

    const todaysTasks = tasks.filter(t => {
      const execDate = new Date(t.execute_at);
      return execDate.getTime() >= today && execDate.getTime() < today + 86400000;
    });

    const usedAmount = todaysTasks.reduce((sum, t) => sum + (t.balance / 1e9), 0);

    return {
      usedAmount,
      limit: 10 // Mock daily limit of 10 SUI
    };
  }, [tasks]);

  // Format tasks for NotificationHub
  const notificationTasks = useMemo(() => {
    return tasks.map(t => ({
      id: t.id,
      recipient: t.recipient,
      amount: t.balance / 1e9,
      executeAt: t.execute_at,
      metadata: t.metadata
    }));
  }, [tasks]);

  return (
    <section className="py-20 px-4 bg-neo-bg min-h-screen" id="app">
      <Toaster position="top-right" toastOptions={{
        className: 'glass',
        style: {
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '12px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
        },
      }} />

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center mb-12">
          <h1 className="font-display text-6xl md:text-8xl font-black text-black text-center mb-8 uppercase tracking-tighter decoration-neo-primary decoration-[12px] underline-offset-[16px]">
            Autopay Scheduler
          </h1>
          <div className="w-full max-w-5xl">
            {/* Folder Tabs */}
            <div className="flex flex-wrap gap-2 px-4 border-b-4 border-black">
              <TabButton
                active={activeTab === 'scheduler'}
                onClick={() => setActiveTab('scheduler')}
                icon={<Calendar size={20} className="mb-1" />}
                label="Scheduler"
              />
              <TabButton
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
                icon={<User size={20} className="mb-1" />}
                label="Dashboard"
              />
              <TabButton
                active={activeTab === 'escrow'}
                onClick={() => setActiveTab('escrow')}
                icon={<Lock size={20} className="mb-1" />}
                label="Escrow"
              />
              <TabButton
                active={activeTab === 'history'}
                onClick={() => setActiveTab('history')}
                icon={<History size={20} className="mb-1" />}
                label="History"
              />
              <div className="w-px h-8 bg-black/20 mx-2 self-center"></div>
              <TabButton
                active={activeTab === 'analytics'}
                onClick={() => setActiveTab('analytics')}
                icon={<BarChart3 size={20} className="mb-1" />}
                label="Analytics"
              />
              <TabButton
                active={activeTab === 'yield'}
                onClick={() => setActiveTab('yield')}
                icon={<TrendingUp size={20} className="mb-1" />}
                label="Yield"
              />
            </div>
          </div>
        </div>

        {activeTab === 'scheduler' && (
          <div className="flex flex-col lg:flex-row gap-8 items-start min-h-[calc(100vh-16rem)]">
            {/* Left Panel (40%) - Interactive Calendar */}
            <div className="w-full lg:w-[40%] flex flex-col gap-6 sticky top-24">
              <CalendarView
                onDateSelect={setSelectedDate}
                selectedDate={selectedDate}
              />

              <SpendingLimits
                usedAmount={spendingStats.usedAmount}
                limit={spendingStats.limit}
                period="daily"
              />
            </div>

            {/* Right Panel (60%) - Form & Management */}
            <div className="w-full lg:w-[60%] flex flex-col gap-6">
              <NotificationHub tasks={notificationTasks} />

              <CreateTaskForm initialDate={selectedDate} />

              <div className="w-full">
                <TaskList onTasksLoaded={setTasks} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto">
            <UserDashboard />
          </div>
        )}

        {activeTab === 'escrow' && (
          <div className="max-w-5xl mx-auto">
            <EscrowSummary />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <TaskHistory />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-6xl mx-auto">
            <AnalyticsDashboard />
          </div>
        )}

        {activeTab === 'yield' && (
          <div className="max-w-6xl mx-auto">
            <YieldRatesPanel />
          </div>
        )}
      </div>
    </section>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-center justify-center px-6 py-3 font-display font-bold uppercase transition-all
      border-t-4 border-l-4 border-r-4 border-black rounded-t-xl
      ${active
        ? 'bg-neo-bg translate-y-[4px] border-b-0 pb-4 z-10'
        : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-black translate-y-[4px] border-b-4 pb-3 mb-1'
      }
    `}
  >
    {icon}
    <span className="text-xs tracking-wider">{label}</span>
  </button>
);
