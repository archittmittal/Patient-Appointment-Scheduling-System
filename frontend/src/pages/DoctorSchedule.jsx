import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';

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
    const dow = d.getDay();
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

const getSlotStyle = (booked, capacity, closed, blocked) => {
    if (closed) return { bg: 'bg-white/5 opacity-30', text: 'text-slate-400', border: 'border-[var(--border-base)]' };
    if (blocked) return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' };
    if (booked === 0) return { bg: 'bg-emerald-500/5', text: 'text-emerald-500', border: 'border-emerald-500/10' };
    if (booked >= capacity) return { bg: 'bg-rose-500/20', text: 'text-rose-500', border: 'border-rose-500/40' };
    if (booked / capacity >= 0.75) return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' };
    return { bg: 'bg-primary/5', text: 'text-primary', border: 'border-primary/20' };
};

const SlotCell = ({ booked, capacity, closed, blocked, isToday }) => {
    const style = getSlotStyle(booked, capacity, closed, blocked);
    const todayRing = isToday ? 'ring-2 ring-primary/20 shadow-lg shadow-primary/5' : '';
    
    if (closed) return (
        <div className={`h-12 flex items-center justify-center rounded-xl text-[10px] uppercase font-black tracking-widest border transition-all ${style.bg} ${style.border} ${todayRing}`}>
            <span className="opacity-40 select-none">—</span>
        </div>
    );
    
    if (blocked) return (
        <div className={`h-12 flex items-center justify-center rounded-xl text-[10px] uppercase font-black tracking-widest border border-dashed transition-all ${style.bg} ${style.border} ${todayRing}`}>
            <span className="select-none font-black">Blocked</span>
        </div>
    );
    
    const pct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
    const barColor = booked >= capacity ? 'bg-rose-500' : booked / capacity >= 0.75 ? 'bg-amber-500' : booked > 0 ? 'bg-primary' : 'bg-emerald-500';
    
    return (
        <div className={`h-14 flex flex-col items-center justify-center rounded-2xl px-2 gap-1.5 border hover:scale-[1.05] hover:z-10 cursor-pointer transition-all duration-300 ${style.bg} ${style.border} ${todayRing}`}>
            <div className={`flex items-center gap-1 ${style.text}`}>
                <span className="text-xs font-black tracking-tight leading-none">{booked}</span>
                <span className="text-[10px] font-black opacity-30 leading-none">/</span>
                <span className="text-[10px] font-black opacity-30 leading-none">{capacity}</span>
            </div>
            <div className="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
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
            const result = await apiClient.get(`/api/doctors/${user.id}/weekly-schedule?week=${toStr(weekStart)}`);
            setData(result);
        } finally { setLoading(false); }
    }, [user?.id, weekStart]);

    useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

    const changeWeek = (offset) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + offset);
        setWeekStart(d);
    };

    if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse font-bold uppercase tracking-widest">Optimizing Matrix Load...</div>;

    const avail    = parseAvailability(data?.availability);
    const capacity = data?.capacity ?? 15;
    const blocked  = new Set(data?.blocked_dates ?? []);
    const todayStr = toStr(new Date());

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateStr = toStr(d);
        const dayAvail = avail?.[DAY_NAMES[d.getDay()]];
        const isOpen   = dayAvail?.open === true;
        const isBlocked = blocked.has(dateStr);
        const slots = (isOpen && !isBlocked) ? generateHourlySlots(dayAvail.from, dayAvail.to) : [];
        return { dateStr, dayLabel: DAY_LABELS[d.getDay()], date: d, isOpen, isBlocked, slots };
    });

    const allSlotLabels = Array.from(new Set(days.flatMap(d => d.slots))).sort();
    const apptIndex = {};
    (data?.appointments ?? []).forEach(a => {
        apptIndex[`${a.date}|${a.time_slot}`] = { booked: Number(a.booked) };
    });

    const dayTotals = days.map(d => d.slots.reduce((sum, slot) => sum + (apptIndex[`${d.dateStr}|${slot}`]?.booked ?? 0), 0));

    const weekLabel = (() => {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        const fmt = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${fmt(weekStart)} — ${fmt(end)}, ${weekStart.getFullYear()}`;
    })();

    return (
        <div className="space-y-8 pb-10 animate-in fade-in duration-700">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                        <CalendarDays size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-[var(--text-base)] tracking-tight uppercase">Clinical Matrix</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Real-time load balancing & resource allocation</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 glass-card p-2 rounded-[2.5rem] border-primary/10 shadow-lg shadow-indigo-500/5">
                    <button onClick={() => changeWeek(-7)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-light/30 text-slate-400 hover:text-primary transition-all active:scale-90"><ChevronLeft size={20} /></button>
                    <span className="text-xs font-black text-[var(--text-base)] min-w-[180px] text-center uppercase tracking-[0.1em]">{weekLabel}</span>
                    <button onClick={() => changeWeek(7)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-primary-light/30 text-slate-400 hover:text-primary transition-all active:scale-90"><ChevronRight size={20} /></button>
                </div>
            </div>

            {/* Load summary summary */}
            <div className="grid grid-cols-7 gap-4">
                {days.map((d, i) => {
                    const isToday = d.dateStr === todayStr;
                    const total = dayTotals[i];
                    const maxSlots = d.slots.length * capacity;
                    const pct = maxSlots > 0 ? Math.round((total / maxSlots) * 100) : 0;
                    return (
                        <div key={d.dateStr} className={`glass-card p-4 text-center transition-all duration-300 hover:translate-y-[-4px] ${isToday ? 'border-primary/50 bg-primary/5 shadow-xl shadow-primary/10' : ''}`}>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-primary' : 'text-slate-400'}`}>{d.dayLabel}</p>
                            <p className={`text-2xl font-black mt-1 tracking-tighter ${isToday ? 'text-primary' : 'text-[var(--text-base)]'}`}>{d.date.getDate()}</p>
                            {!d.isOpen || d.isBlocked ? (
                                <span className="text-[8px] font-black text-rose-400 mt-2 block uppercase tracking-widest">{d.isBlocked ? 'Blocked' : 'O.O.O'}</span>
                            ) : (
                                <div className="mt-4 space-y-1.5 px-1">
                                    <div className="w-full h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${pct >= 75 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{pct}% Usage</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Matrix Grid */}
            {allSlotLabels.length === 0 ? (
                <div className="glass-card p-20 text-center border-dashed border-slate-300/30">
                    <Clock size={48} className="mx-auto text-slate-300 mb-4 opacity-20" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">No active clinical cycles configured for this range.</p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden border-slate-200/50">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-primary-light/5 border-b border-[var(--border-base)]">
                                    <th className="px-8 py-6 text-left w-48">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <Clock size={14} className="text-primary" /> Matrix Node
                                        </div>
                                    </th>
                                    {days.map(d => (
                                        <th key={d.dateStr} className={`px-2 py-6 text-center ${d.dateStr === todayStr ? 'bg-primary/5' : ''}`}>
                                            <div className="flex flex-col items-center">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${d.dateStr === todayStr ? 'text-primary' : 'text-slate-400'}`}>{d.dayLabel}</span>
                                                <span className={`text-base font-black tracking-tighter ${d.dateStr === todayStr ? 'text-primary' : 'text-[var(--text-base)]'}`}>{d.date.getDate()}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-base)]">
                                {allSlotLabels.map(slot => (
                                    <tr key={slot} className="group hover:bg-primary-light/5 transition-colors">
                                        <td className="px-8 py-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-transparent group-hover:border-primary/20 group-hover:text-primary transition-all">
                                                {slot.replace(' – ', '-')}
                                            </span>
                                        </td>
                                        {days.map(d => {
                                            const active = d.slots.includes(slot);
                                            const booking = apptIndex[`${d.dateStr}|${slot}`]?.booked || 0;
                                            return (
                                                <td key={d.dateStr} className={`px-2 py-3 ${d.dateStr === todayStr ? 'bg-primary/5' : ''}`}>
                                                    <SlotCell booked={booking} capacity={capacity} closed={!active} blocked={d.isBlocked} isToday={d.dateStr === todayStr} />
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

            {/* Legend section */}
            <div className="glass-card p-6 flex flex-wrap items-center gap-8 border-primary/10">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Optimal Flow</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/40"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Standard Load</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">High Volume</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Critical Capacity</span>
                </div>
                <div className="ml-auto glass-card py-2 px-5 bg-primary/10 border-primary/10 flex items-center gap-3">
                    <Users size={16} className="text-primary" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">Unit capacity: {capacity} Slots</span>
                </div>
            </div>
        </div>
    );
};

export default DoctorSchedule;
