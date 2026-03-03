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
    if (closed || blocked) return 'bg-gray-50 text-gray-300';
    if (booked === 0)                               return 'bg-green-50  text-green-700';
    if (booked >= capacity)                         return 'bg-red-50    text-red-700 font-semibold';
    if (booked / capacity >= 0.75)                  return 'bg-orange-50 text-orange-700';
    return 'bg-yellow-50 text-yellow-700';
};

const SlotCell = ({ booked, capacity, closed, blocked, isToday }) => {
    const base = fillColor(booked, capacity, closed, blocked);
    const todayRing = isToday ? 'ring-1 ring-primary/40' : '';
    if (closed) return (
        <div className={`h-12 flex items-center justify-center rounded-lg text-xs ${base} ${todayRing}`}>
            <span className="text-gray-300">—</span>
        </div>
    );
    if (blocked) return (
        <div className={`h-12 flex items-center justify-center rounded-lg text-xs ${base} ${todayRing}`}>
            <span className="text-red-300 line-through">Blocked</span>
        </div>
    );
    const pct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
    const barColor = booked >= capacity ? 'bg-red-400' : booked / capacity >= 0.75 ? 'bg-orange-400' : booked > 0 ? 'bg-yellow-400' : 'bg-green-400';
    return (
        <div className={`h-12 flex flex-col items-center justify-center rounded-lg px-1 gap-1 ${base} ${todayRing}`}>
            <span className="text-xs font-semibold leading-none">{booked}/{capacity}</span>
            <div className="w-full h-1 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
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
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarDays size={24} className="text-primary" />
                        Weekly Schedule
                    </h1>
                    <p className="text-gray-500 mt-1">View your appointment load across the week.</p>
                </div>

                {/* Week navigation */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={prevWeek}
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-semibold text-gray-700 min-w-[200px] text-center">{weekLabel}</span>
                    <button
                        onClick={nextWeek}
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                    {!isCurrentWeek && (
                        <button onClick={goToday} className="ml-1 px-3 py-1.5 text-xs font-medium border border-primary/40 text-primary rounded-xl hover:bg-primary-light transition-colors">
                            This Week
                        </button>
                    )}
                </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-7 gap-2">
                {days.map((d, i) => {
                    const isToday   = d.dateStr === todayStr;
                    const total     = dayTotals[i];
                    const maxSlots  = d.slots.length * capacity;
                    const pct       = maxSlots > 0 ? Math.round((total / maxSlots) * 100) : 0;
                    return (
                        <div key={d.dateStr} className={`bg-white rounded-2xl border p-3 text-center shadow-sm ${isToday ? 'border-primary/40 ring-1 ring-primary/20' : 'border-gray-100'}`}>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-primary' : 'text-gray-400'}`}>
                                {d.dayLabel}
                            </p>
                            <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-gray-800'}`}>
                                {d.date.getDate()}
                            </p>
                            {d.isBlocked ? (
                                <span className="text-xs text-red-400 mt-1 block">Blocked</span>
                            ) : !d.isOpen ? (
                                <span className="text-xs text-gray-300 mt-1 block">Off</span>
                            ) : (
                                <>
                                    <p className="text-xs font-semibold text-gray-700 mt-1">{total} booked</p>
                                    <div className="w-full h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-red-400' : pct >= 40 ? 'bg-orange-400' : 'bg-green-400'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{pct}% full</p>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Grid */}
            {allSlotLabels.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
                    No availability configured for this week.
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm table-fixed">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                                        <div className="flex items-center gap-1">
                                            <Clock size={13} />
                                            Time Slot
                                        </div>
                                    </th>
                                    {days.map(d => (
                                        <th key={d.dateStr} className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide ${d.dateStr === todayStr ? 'text-primary' : 'text-gray-500'}`}>
                                            <span>{d.dayLabel}</span>
                                            <span className={`ml-1 font-bold ${d.dateStr === todayStr ? 'text-primary' : 'text-gray-700'}`}>
                                                {d.date.getDate()}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {allSlotLabels.map(slotLabel => (
                                    <tr key={slotLabel} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2 font-mono text-xs text-gray-500 w-36 whitespace-nowrap">
                                            {slotLabel}
                                        </td>
                                        {days.map(d => {
                                            const slotExists = d.slots.includes(slotLabel);
                                            const isToday    = d.dateStr === todayStr;
                                            if (!slotExists) {
                                                return (
                                                    <td key={d.dateStr} className="px-2 py-2">
                                                        <SlotCell booked={0} capacity={capacity} closed={true} blocked={false} isToday={isToday} />
                                                    </td>
                                                );
                                            }
                                            const key    = `${d.dateStr}|${slotLabel}`;
                                            const entry  = apptIndex[key];
                                            const booked = entry ? entry.booked : 0;
                                            return (
                                                <td key={d.dateStr} className="px-2 py-2">
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
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-green-50 border border-green-200" />
                    Available
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-yellow-50 border border-yellow-200" />
                    &lt;75% booked
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-orange-50 border border-orange-200" />
                    ≥75% booked
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
                    Full
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
                    Off / Blocked
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                    <Users size={13} />
                    Capacity: {capacity} patients per slot
                </div>
            </div>
        </div>
    );
};

export default DoctorSchedule;
