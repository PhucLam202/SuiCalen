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
          <h1 className="font-display text-5xl md:text-7xl font-black text-black text-center mb-4 uppercase drop-shadow-neo">
            Autopay Scheduler
          </h1>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <TabButton 
              active={activeTab === 'scheduler'} 
              onClick={() => setActiveTab('scheduler')}
              icon={<Calendar size={20} />}
              label="Scheduler"
            />
            <TabButton 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<User size={20} />}
              label="My Dashboard"
            />
            <TabButton 
              active={activeTab === 'escrow'} 
              onClick={() => setActiveTab('escrow')}
              icon={<Lock size={20} />}
              label="Escrowed Funds"
            />
            <TabButton 
              active={activeTab === 'history'} 
              onClick={() => setActiveTab('history')}
              icon={<History size={20} />}
              label="Activity History"
            />
            <TabButton 
              active={activeTab === 'analytics'} 
              onClick={() => setActiveTab('analytics')}
              icon={<BarChart3 size={20} />}
              label="Analytics"
            />
            <TabButton
              active={activeTab === 'yield'}
              onClick={() => setActiveTab('yield')}
              icon={<TrendingUp size={20} />}
              label="Yield"
            />
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
    className={`flex items-center gap-2 px-6 py-3 font-display font-bold uppercase border-[1.5px] border-black transition-all rounded-lg ${
      active 
        ? 'bg-neo-primary text-white shadow-none translate-x-[2px] translate-y-[2px]' 
        : 'bg-white text-black shadow-neo hover:bg-neo-accent hover:shadow-neo-lg hover:-translate-y-1'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
