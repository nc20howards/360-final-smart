
import React, { useState, useMemo } from 'react';
import { User } from '../types';

interface TeacherCalendarViewProps {
    user: User;
}

// Mock data for events - in a real app, this would come from a service
const mockEvents = [
    { date: '2024-07-25', title: 'S.3 Physics Class', time: '10:00 AM', type: 'class' },
    { date: '2024-07-29', title: 'Staff Meeting', time: '02:00 PM', type: 'meeting' },
    { date: '2024-08-05', title: 'S.4 Chemistry Class', time: '11:00 AM', type: 'class' },
    { date: '2024-08-15', title: 'Mid-term Exams Begin', time: '', type: 'exam' },
    { date: '2024-08-22', title: 'S.5 Mathematics Class', time: '09:00 AM', type: 'class' },
    { date: '2024-08-22', title: 'Parent-Teacher Conference', time: '03:00 PM', type: 'meeting' },
];

const holidays = [
    { date: '2024-01-01', title: "New Year's Day", type: 'holiday' },
    { date: '2024-01-26', title: 'Liberation Day', type: 'holiday' },
    { date: '2024-02-14', title: "Valentine's Day", type: 'special' },
    { date: '2024-03-08', title: "International Women's Day", type: 'holiday' },
    { date: '2024-05-01', title: 'Labour Day', type: 'holiday' },
    { date: '2024-06-03', title: "Martyrs' Day", type: 'holiday' },
    { date: '2024-06-09', title: "National Heroes' Day", type: 'holiday' },
    { date: '2024-10-09', title: 'Independence Day', type: 'holiday' },
    { date: '2024-10-31', title: 'Halloween', type: 'special' },
    { date: '2024-12-25', title: 'Christmas Day', type: 'holiday' },
    { date: '2024-12-26', title: 'Boxing Day', type: 'holiday' },
];

const allEvents = [...mockEvents, ...holidays];

interface PopoverEvent {
    title: string;
    time: string;
    type: string;
}


const TeacherCalendarView: React.FC<TeacherCalendarViewProps> = ({ user }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [hoveredEvent, setHoveredEvent] = useState<PopoverEvent | null>(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.

    const eventsForMonth = useMemo(() => allEvents.filter(event => {
        const eventDate = new Date(event.date);
        const eventYear = eventDate.getFullYear();
        const eventMonth = eventDate.getMonth();
        return eventYear === currentDate.getFullYear() && eventMonth === currentDate.getMonth();
    }), [currentDate]);

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, eventData: PopoverEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPopoverPosition({ top: window.scrollY + rect.bottom + 8, left: window.scrollX + rect.left });
        setHoveredEvent(eventData);
    };

    const handleMouseLeave = () => {
        setHoveredEvent(null);
    };

    const getEventTypeStyle = (type: string) => {
        switch (type) {
            case 'class': return { dot: 'bg-sky-500', text: 'text-sky-300', popoverBorder: 'border-sky-500' };
            case 'meeting': return { dot: 'bg-purple-500', text: 'text-purple-300', popoverBorder: 'border-purple-500' };
            case 'exam': return { dot: 'bg-rose-500', text: 'text-rose-300', popoverBorder: 'border-rose-500' };
            case 'holiday': return { dot: 'bg-emerald-500', text: 'text-emerald-300', popoverBorder: 'border-emerald-500' };
            case 'special': return { dot: 'bg-amber-500', text: 'text-amber-300', popoverBorder: 'border-amber-500' };
            default: return { dot: 'bg-gray-500', text: 'text-gray-300', popoverBorder: 'border-gray-500' };
        }
    };

    const calendarDays = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarDays.push(<div key={`empty-${i}`} className="border-r border-b border-gray-700/50"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const today = new Date();
        const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
        const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = eventsForMonth.filter(e => e.date === dateString);

        calendarDays.push(
            <div key={day} className="border-r border-b border-gray-700/50 p-2 flex flex-col min-h-[120px] transition-colors duration-200 hover:bg-gray-700/50">
                <div className="flex justify-end">
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center ${isToday ? 'bg-cyan-500 text-white rounded-full' : 'text-gray-300'}`}>{day}</span>
                </div>
                <div className="flex-grow overflow-y-auto space-y-1.5 mt-1 pr-1">
                    {dayEvents.map((event, index) => {
                        const style = getEventTypeStyle(event.type);
                        // FIX: The 'time' property can be undefined for some events (like holidays). Provide a fallback empty string to satisfy the PopoverEvent type.
                        const popoverData: PopoverEvent = { title: event.title, time: (event as any).time || '', type: event.type };
                        return (
                            <div 
                                key={index} 
                                onMouseEnter={(e) => handleMouseEnter(e, popoverData)}
                                onMouseLeave={handleMouseLeave}
                                className="flex items-center gap-2 cursor-pointer p-1 rounded-md hover:bg-gray-600/70"
                            >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}></div>
                                <p className={`text-xs font-semibold truncate ${style.text}`}>{event.title}</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    }

    const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    
    return (
        <div className="animate-slide-in-left-fade">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Class Calendar</h2>
            <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                <div className="flex justify-between items-center p-4">
                    <button onClick={goToPreviousMonth} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-semibold transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Prev
                    </button>
                    <h3 className="text-lg sm:text-2xl font-bold text-white tracking-wide">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={goToNextMonth} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-semibold transition-colors flex items-center gap-2">
                        Next
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
                
                <div className="grid grid-cols-7 bg-gray-900/50 text-center font-semibold text-gray-400 text-xs sm:text-sm border-t border-b border-gray-700/50">
                    {daysOfWeek.map(day => <div key={day} className="py-3 border-r border-gray-700/50 last:border-r-0">{day}</div>)}
                </div>
                
                <div className="grid grid-cols-7 border-l border-t border-gray-700/50">
                    {calendarDays}
                </div>
            </div>

            {hoveredEvent && (
                <div
                    style={{ top: popoverPosition.top, left: popoverPosition.left }}
                    className={`fixed z-50 p-3 bg-gray-900 border-t-4 ${getEventTypeStyle(hoveredEvent.type).popoverBorder} rounded-lg shadow-2xl text-white w-56 animate-fade-in-up`}
                >
                    <p className="font-bold text-sm">{hoveredEvent.title}</p>
                    {hoveredEvent.time && (
                        <p className="text-xs text-gray-400 mt-1">{hoveredEvent.time}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeacherCalendarView;
