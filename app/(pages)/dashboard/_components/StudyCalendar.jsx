'use client';

import { useState } from 'react';
import Link from 'next/link';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

function formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function StudyCalendar({ schedule = {} }) {
    const now = new Date();
    const [currentMonth, setCurrentMonth] = useState(now.getMonth());
    const [currentYear, setCurrentYear] = useState(now.getFullYear());
    const [selectedDate, setSelectedDate] = useState(null);

    const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());

    // Navigation limits: current month -1 to +11 months
    const minDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 11, 1);

    const canGoPrev = new Date(currentYear, currentMonth - 1, 1) >= minDate;
    const canGoNext = new Date(currentYear, currentMonth + 1, 1) <= maxDate;

    const goToPrev = () => {
        if (!canGoPrev) return;
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
        setSelectedDate(null);
    };

    const goToNext = () => {
        if (!canGoNext) return;
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
        setSelectedDate(null);
    };

    const goToToday = () => {
        setCurrentMonth(now.getMonth());
        setCurrentYear(now.getFullYear());
        setSelectedDate(todayKey);
    };

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    // Build calendar grid
    const calendarDays = [];
    // Empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    // Get intensity for a date
    const getDateInfo = (day) => {
        if (!day) return null;
        const key = formatDateKey(currentYear, currentMonth, day);
        const items = schedule[key];
        if (!items || items.length === 0) return null;
        const totalQuestions = items.reduce((sum, item) => sum + item.question_count, 0);
        return { key, items, totalQuestions };
    };

    // Intensity color
    const getIntensityColor = (total) => {
        if (total <= 5) return 'bg-blue-100 text-blue-800';
        if (total <= 15) return 'bg-amber-100 text-amber-800';
        return 'bg-red-100 text-red-800';
    };

    const getDotColor = (total) => {
        if (total <= 5) return 'bg-blue-500';
        if (total <= 15) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const selectedInfo = selectedDate ? schedule[selectedDate] : null;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Calendar Header */}
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Study Calendar</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Your spaced repetition schedule</p>
                </div>
                <button
                    onClick={goToToday}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors"
                >
                    Today
                </button>
            </div>

            {/* Month Navigation */}
            <div className="px-6 pb-3 flex items-center justify-between">
                <button
                    onClick={goToPrev}
                    disabled={!canGoPrev}
                    className={`p-1.5 rounded-lg transition-colors ${canGoPrev ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-200 cursor-not-allowed'}`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <span className="text-sm font-semibold text-gray-800">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <button
                    onClick={goToNext}
                    disabled={!canGoNext}
                    className={`p-1.5 rounded-lg transition-colors ${canGoNext ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-200 cursor-not-allowed'}`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 px-4">
                {DAY_LABELS.map((label) => (
                    <div key={label} className="text-center text-xs font-semibold text-gray-400 py-2">
                        {label}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 px-4 pb-4 gap-y-1">
                {calendarDays.map((day, idx) => {
                    if (day === null) {
                        return <div key={`empty-${idx}`} className="h-10" />;
                    }

                    const info = getDateInfo(day);
                    const dateKey = formatDateKey(currentYear, currentMonth, day);
                    const isToday = dateKey === todayKey;
                    const isSelected = dateKey === selectedDate;
                    const isPast = new Date(currentYear, currentMonth, day) < new Date(now.getFullYear(), now.getMonth(), now.getDate());

                    return (
                        <button
                            key={`day-${day}`}
                            onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                            className={`
                relative h-10 rounded-lg text-sm font-medium transition-all duration-150 flex flex-col items-center justify-center
                ${isToday && !isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-105' : ''}
                ${!isSelected && info ? getIntensityColor(info.totalQuestions) + ' hover:scale-105' : ''}
                ${!isSelected && !info && !isPast ? 'text-gray-700 hover:bg-gray-50' : ''}
                ${!isSelected && !info && isPast ? 'text-gray-300' : ''}
              `}
                        >
                            <span className="leading-none">{day}</span>
                            {info && !isSelected && (
                                <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${getDotColor(info.totalQuestions)}`} />
                            )}
                            {info && isSelected && (
                                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="px-6 pb-3 flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Light (1–5)
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Moderate (6–15)
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Heavy (16+)
                </div>
            </div>

            {/* Selected Day Details */}
            {selectedDate && (
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-800">
                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </h3>
                        {selectedDate === todayKey && (
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Today</span>
                        )}
                    </div>

                    {selectedInfo && selectedInfo.length > 0 ? (
                        <div className="space-y-2">
                            {selectedInfo.map((item, i) => {
                                const isFuture = selectedDate > todayKey;
                                return (
                                    <div
                                        key={`sched-${item.course_id}-${item.material_id}-${i}`}
                                        className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-indigo-200 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{item.topic_name}</p>
                                            <p className="text-xs text-gray-400 truncate">{item.course_name}</p>
                                        </div>
                                        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.question_count <= 5 ? 'bg-blue-100 text-blue-700' :
                                                item.question_count <= 15 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {item.question_count} {isFuture ? 'scheduled' : 'due'}
                                            </span>
                                            {!isFuture ? (
                                                <Link
                                                    href={`/dashboard/student/course/${item.course_id}/review?materialId=${item.material_id}&topic=${encodeURIComponent(item.topic_name)}`}
                                                    className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                                >
                                                    Review ({item.question_count} due)
                                                </Link>
                                            ) : (
                                                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                                                    Upcoming
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-400">No reviews scheduled for this day</p>
                            <p className="text-xs text-gray-300 mt-1">Keep studying to build your schedule!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
