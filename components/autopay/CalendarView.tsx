import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  onDateSelect: (date: Date) => void;
  selectedDate?: Date;
  onRangeSelect?: (start: Date, end: Date) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onDateSelect, selectedDate, onRangeSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           currentMonth.getMonth() === today.getMonth() && 
           currentMonth.getFullYear() === today.getFullYear();
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return day === selectedDate.getDate() &&
           currentMonth.getMonth() === selectedDate.getMonth() &&
           currentMonth.getFullYear() === selectedDate.getFullYear();
  };

  // Check if a day is within the drag range
  const isInRange = (day: number) => {
    if (!dragStart || !dragEnd) return false;
    
    const currentDayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const start = dragStart < dragEnd ? dragStart : dragEnd;
    const end = dragStart < dragEnd ? dragEnd : dragStart;
    
    // Reset time components for comparison
    const check = new Date(currentDayDate.setHours(0,0,0,0));
    const s = new Date(new Date(start).setHours(0,0,0,0));
    const e = new Date(new Date(end).setHours(0,0,0,0));
    
    return check >= s && check <= e;
  };

  const handleMouseDown = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0);
    setIsDragging(true);
    setDragStart(date);
    setDragEnd(date);
    onDateSelect(date); // Also select the start date
  };

  const handleMouseEnter = (day: number) => {
    if (isDragging) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day, 12, 0, 0);
      setDragEnd(date);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd && onRangeSelect) {
      const start = dragStart < dragEnd ? dragStart : dragEnd;
      const end = dragStart < dragEnd ? dragEnd : dragStart;
      onRangeSelect(start, end);
    }
    setIsDragging(false);
  };

  // Global mouse up to catch release outside calendar
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  return (
    <div className="glass border-[1.5px] border-black/10 p-6 shadow-soft-lg w-full h-full rounded-xl transition-all hover:shadow-neo-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">
          {currentMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 border border-black/10 rounded-lg hover:bg-neo-bg transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="p-2 border border-black/10 rounded-lg hover:bg-neo-bg transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 font-mono font-bold mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-gray-500 uppercase text-[10px] tracking-wider">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" onMouseLeave={() => isDragging && setIsDragging(false)}>
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square"></div>
        ))}
        
        {days.map(day => {
          const inRange = isInRange(day);
          const selected = isSelected(day);
          const today = isToday(day);
          
          return (
            <button
              key={day}
              onMouseDown={() => handleMouseDown(day)}
              onMouseEnter={() => handleMouseEnter(day)}
              onMouseUp={handleMouseUp}
              className={`
                aspect-square flex items-center justify-center font-mono text-sm rounded-lg transition-all
                ${today ? 'bg-neo-accent/20 border border-neo-accent text-black font-bold' : ''}
                ${selected ? 'bg-neo-primary text-white shadow-soft font-bold transform scale-105' : ''}
                ${inRange && !selected ? 'bg-neo-primary/20' : ''}
                ${!selected && !inRange ? 'hover:bg-gray-100 hover:scale-110' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
          <div className="w-3 h-3 bg-neo-primary rounded-sm"></div>
          <span>Selected</span>
          <div className="w-3 h-3 bg-neo-accent/20 border border-neo-accent rounded-sm ml-2"></div>
          <span>Today</span>
        </div>
        <p className="mt-2 text-[10px] text-gray-400 font-mono text-center">
          Click and drag to select range
        </p>
      </div>
    </div>
  );
};
