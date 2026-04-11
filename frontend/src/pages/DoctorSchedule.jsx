import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getMondayOf = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return d;
};

const parseAvailability = (av) => {
    if (!av) return null;
    return typeof av === 'string' ? JSON.parse(av) : av;
};

const generateHourlySlots = (from, to) => {
    const [fh] = from.split(':').map(Number);
    const [th] = to.split(':').map(Number);
    const slots = [];
    for (let h = fh; h < th; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`);
    }
    return slots;
};

const fillColor = (booked, capacity, closed, blocked) => {
    if (closed) return 'bg-slate-50/50 text-slate-300 border-slate-100/50 opacity-40';
    if (blocked) return 'bg-rose-50/50 text-rose-300 border-rose-100/50';
    if (booked === 0) return 'bg-emerald-50/30 text-emerald-600 border-emerald-100/50';
    if (booked >= capacity) return 'bg-rose-50 text-rose-700 border-rose-200 font-black';
    if (booked / capacity >= 0.75) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-indigo-50/50 text-indigo-700 border-indigo-100';
};

const SlotCell = ({ booked, capacity, closed, blocked, isToday }) => {
    const base = fillColor(booked, capacity, closed, blocked);
    const todayRing = isToday ? 'ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/5' : '';
    
    if (closed) return (
        <div className={`h-12 flex items-center justify-center rounded-xl text-[10px] uppercase font-black tracking-widest border transition-all ${base} ${todayRing}`}>
            <span className="opacity-40 select-none">—</span>
        </div>
    );
    
    if (blocked) return (
        <div className={`h-12 flex items-center justify-center rounded-xl text-[10px] uppercase font-black tracking-widest border border-dashed transition-all ${base} ${todayRing}`}>
            <span className="text-rose-400 select-none">Blocked</span>
        </div>
    );
    
    const pct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
    const barColor = booked >= capacity ? 'bg-rose-500' : booked / capacity >= 0.75 ? 'bg-amber-500' : booked > 0 ? 'bg-indigo-500' : 'bg-emerald-500';
    
    return (
        <div className={`h-14 flex flex-col items-center justify-center rounded-2xl px-2 gap-1.5 border hover:scale-[1.02] hover:z-10 cursor-default transition-all duration-300 ${base} ${todayRing}`}>
            <div className="flex items-center gap-1">
                <span className="text-xs font-black tracking-tight leading-none">{booked}</span>
                <span className="text-[10px] font-black opacity-30 leading-none">/</span>
                <span className="text-[10px] font-black opacity-30 leading-none">{capacity}</span>
            </div>
            <div className="w-full h-1 bg-white/40 rounded-full overflow-hidden border border-black/5">
                <div className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

const DoctorSchedule = () => {
    const { user } = useAuth();
    const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchSchedule = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const res = await fetch(
                `${API}/api/doctors/${user.id}/weekly-schedule?week=${toStr(weekStart)}`,
                { headers: authedHeaders() }
            );
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error('Schedule fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, weekStart]);

    useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

    const prevWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        setWeekStart(d);
    };
    const nextWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        setWeekStart(d);
    };
    const goToday = () => setWeekStart(getMondayOf(new Date()));

    if (loading) {
        return <div className="p-10 text-center text-gray-400 animate-pulse">Loading schedule...</div>;
    }

    const avail    = parseAvailability(data?.availability);
    const capacity = data?.capacity ?? 15;
    const blocked  = new Set(data?.blocked_dates ?? []);
    const todayStr = toStr(new Date());

    // Build 7 days: Mon → Sun
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateStr = toStr(d);
        const dayName = DAY_NAMES[d.getDay()]; // 'monday', etc.
        const dayLabel = DAY_LABELS[d.getDay()];
        const dayAvail = avail?.[dayName];
        const isOpen   = dayAvail?.open === true;
        const isBlocked = blocked.has(dateStr);
        const slots = (isOpen && !isBlocked) ? generateHourlySlots(dayAvail.from, dayAvail.to) : [];
        return { dateStr, dayName, dayLabel, date: d, isOpen, isBlocked, slots };
    });

    // Union of all slot labels across open days → row headers
    const allSlotLabels = Array.from(
        new Set(days.flatMap(d => d.slots))
    ).sort();

    // Index appointments: { 'YYYY-MM-DD|09:00 – 10:00': { booked, completed, cancelled } }
    const apptIndex = {};
    (data?.appointments ?? []).forEach(a => {
        apptIndex[`${a.date}|${a.time_slot}`] = {
            booked:    Number(a.booked),
            completed: Number(a.completed),
            cancelled: Number(a.cancelled),
        };
    });

    // Per-day totals
    const dayTotals = days.map(d => {
        return d.slots.reduce((sum, slot) => {
            const key = `${d.dateStr}|${slot}`;
            return sum + (apptIndex[key]?.booked ?? 0);
        }, 0);
    });

    const weekLabel = (() => {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        const fmt = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${fmt(weekStart)} – ${fmt(end)}, ${weekStart.getFullYear()}`;
    })();

    const isCurrentWeek = toStr(getMondayOf(new Date())) === toStr(weekStart);

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight uppercase">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                            <CalendarDays size={24} strokeWidth={2.5} />
                        </div>
                        Clinical Schedule
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 ml-15">Real-time clinical load and appointment queue management.</p>
                </div>

                {/* Week navigation */}
                <div className="flex items-center gap-3 bg-white/50 p-2 rounded-[2rem] border border-white/80 shadow-sm backdrop-blur-md">
                    <button
                        onClick={prevWeek}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 group"
                    >
                        <ChevronLeft size={20} className="text-slate-400 group-hover:text-indigo-600" />
                    </button>
                    <span className="text-xs font-black text-slate-900 min-w-[180px] text-center uppercase tracking-widest">{weekLabel}</span>
                    <button
                        onClick={nextWeek}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 group"
                    >
                        <ChevronRight size={20} className="text-slate-400 group-hover:text-indigo-600" />
                    </button>
                    {!isCurrentWeek && (
                        <button 
                            onClick={goToday} 
                            className="ml-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            Back to Today
                        </button>
                    )}
                </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-7 gap-4">
                {days.map((d, i) => {
                    const isToday   = d.dateStr === todayStr;
                    const total     = dayTotals[i];
                    const maxSlots  = d.slots.length * capacity;
                    const pct       = maxSlots > 0 ? Math.round((total / maxSlots) * 100) : 0;
                    return (
                        <div 
                            key={d.dateStr} 
                            className={`glass-card p-4 text-center transition-all duration-300 hover:scale-[1.05] ${
                                isToday ? 'border-indigo-500/50 shadow-xl shadow-indigo-500/10' : 'border-slate-100'
                            }`}
                        >
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {d.dayLabel}
                            </p>
                            <p className={`text-2xl font-black mt-1 leading-none tracking-tighter ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>
                                {d.date.getDate()}
                            </p>
                            {d.isBlocked ? (
                                <span className="text-[8px] font-black text-rose-400 mt-2 block uppercase tracking-widest">Blocked</span>
                            ) : !d.isOpen ? (
                                <span className="text-[8px] font-black text-slate-300 mt-2 block uppercase tracking-widest">Vacation</span>
                            ) : (
                                <>
                                    <div className="mt-3 space-y-1.5">
                                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden border border-black/5">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${pct >= 75 ? 'bg-rose-400' : pct >= 40 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                            {total} Booked <span className="opacity-40">•</span> {pct}%
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Grid */}
            {allSlotLabels.length === 0 ? (
                <div className="glass-card p-16 text-center border-dashed">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100">
                        <Clock size={32} />
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No availability configured for this week cycle.</p>
                </div>
            ) : (
                <div className="glass-card p-0 overflow-hidden border-slate-200/50">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm table-fixed border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-left w-44">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                            <Clock size={14} strokeWidth={2.5} className="text-indigo-400" />
                                            Schedule Matrix
                                        </div>
                                    </th>
                                    {days.map(d => (
                                        <th key={d.dateStr} className={`px-2 py-4 text-center transition-colors ${d.dateStr === todayStr ? 'bg-indigo-50/30' : ''}`}>
                                            <div className="flex flex-col items-center">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${d.dateStr === todayStr ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {d.dayLabel}
                                                </span>
                                                <span className={`text-base font-black tracking-tighter ${d.dateStr === todayStr ? 'text-indigo-600' : 'text-slate-900'}`}>
                                                    {d.date.getDate()}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50">
                                {allSlotLabels.map(slotLabel => (
                                    <tr key={slotLabel} className="group hover:bg-slate-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/50 group-hover:bg-white group-hover:text-indigo-600 transition-all">
                                                {slotLabel.replace(' – ', '-')}
                                            </span>
                                        </td>
                                        {days.map(d => {
                                            const slotExists = d.slots.includes(slotLabel);
                                            const isToday    = d.dateStr === todayStr;
                                            if (!slotExists) {
                                                return (
                                                    <td key={d.dateStr} className={`px-2 py-3 transition-colors ${isToday ? 'bg-indigo-50/10' : ''}`}>
                                                        <SlotCell booked={0} capacity={capacity} closed={true} blocked={false} isToday={isToday} />
                                                    </td>
                                                );
                                            }
                                            const key    = `${d.dateStr}|${slotLabel}`;
                                            const entry  = apptIndex[key];
                                            const booked = entry ? entry.booked : 0;
                                            return (
                                                <td key={d.dateStr} className={`px-2 py-3 transition-colors ${isToday ? 'bg-indigo-50/10' : ''}`}>
                                                    <SlotCell
                                                        booked={booked}
                                                        capacity={capacity}
                                                        closed={false}
                                                        blocked={d.isBlocked}
                                                        isToday={isToday}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-full mb-2">Metric Indicators</p>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-lg bg-emerald-50 border border-emerald-100 shadow-sm" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Optimal Load</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-lg bg-indigo-50 border border-indigo-100 shadow-sm" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-lg bg-amber-50 border border-amber-100 shadow-sm" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">High Load</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-lg bg-rose-50 border border-rose-100 shadow-sm" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Full Capacity</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-lg bg-slate-50 border border-slate-200 border-dashed shadow-sm" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inactive/Off</span>
                </div>
                <div className="flex items-center gap-2 ml-auto py-2 px-4 bg-white rounded-full border border-slate-100 shadow-sm">
                    <Users size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Unit Capacity: {capacity} patients</span>
                </div>
            </div>
        </div>
    );
};

export default DoctorSchedule;
