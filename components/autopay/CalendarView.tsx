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
    const check = new Date(currentDayDate.setHours(0, 0, 0, 0));
    const s = new Date(new Date(start).setHours(0, 0, 0, 0));
    const e = new Date(new Date(end).setHours(0, 0, 0, 0));

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
    <div className="bg-white border-4 border-black p-6 w-full h-full relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight text-black border-2 border-black bg-neo-bg px-3 py-1">
          {currentMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white transition-all">
            <ChevronLeft size={20} />
          </button>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white transition-all">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 font-mono font-bold text-sm mb-2 border-b-2 border-black pb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
          <div key={day} className="text-center text-gray-400">{day}</div>
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
                aspect-square flex items-center justify-center font-display font-bold text-base border-2 border-transparent transition-all relative
                ${today && !selected ? 'border-neo-accent bg-neo-accent/20' : ''}
                ${selected ? 'bg-black text-white border-black z-10' : 'hover:border-black hover:bg-gray-50'}
                ${inRange && !selected ? 'bg-gray-200' : ''}
              `}
            >
              {day}
              {today && (
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-neo-accent rounded-full border border-black"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Decorative corner */}
      <div className="absolute -bottom-2 -right-2 w-full h-full border-r-4 border-b-4 border-black pointer-events-none -z-10"></div>
    </div>
  );
};
