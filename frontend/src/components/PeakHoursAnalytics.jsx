/**
 * Issue #44: Peak Hours Analytics Component
 * Beautiful visualization of doctor's appointment patterns
 */

import React, { useState, useEffect } from 'react';
import { 
    Clock, TrendingUp, TrendingDown, Calendar, Users, 
    Zap, Sun, Moon, Star, Info, ChevronDown, ChevronUp 
} from 'lucide-react';
import { API } from '../config/api';

// Traffic level badge component
const TrafficBadge = ({ level }) => {
    const config = {
        'very-high': { label: 'Peak Capacity', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: TrendingUp },
        'high': { label: 'High Demand', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: TrendingUp },
        'normal': { label: 'Steady Flow', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: Users },
        'low': { label: 'High Availability', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: TrendingDown },
        'very-low': { label: 'Optimal Booking', color: 'bg-sky-50 text-sky-600 border-sky-100', icon: Star }
    };
    
    const cfg = config[level] || config.normal;
    const Icon = cfg.icon;
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${cfg.color}`}>
            <Icon size={12} strokeWidth={2.5} />
            {cfg.label}
        </span>
    );
};

// Heatmap cell
const HeatmapCell = ({ value, maxValue }) => {
    const intensity = value / maxValue;
    let bgClass = 'bg-slate-50';
    
    if (intensity > 0.8) bgClass = 'bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]';
    else if (intensity > 0.6) bgClass = 'bg-indigo-400';
    else if (intensity > 0.4) bgClass = 'bg-indigo-200';
    else if (intensity > 0.2) bgClass = 'bg-indigo-100 text-indigo-600';
    else if (intensity > 0) bgClass = 'bg-indigo-50';
    
    return (
        <div 
            className={`w-full aspect-square rounded-lg ${bgClass} transition-all duration-300 hover:scale-125 hover:z-10 cursor-pointer border border-white/20`}
            title={`${value}% of max clinical load`}
        />
    );
};

// Time slot recommendation card
const BestTimeCard = ({ time, rank }) => {
    const medals = ['🥇', '🥈', '🥉'];
    
    return (
        <div className="flex items-center gap-4 p-5 bg-white rounded-[2rem] border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                {medals[rank - 1] || rank}
            </div>
            <div>
                <p className="text-sm font-black text-slate-900 tracking-tight">{time.day}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{time.time}</p>
            </div>
            <div className="ml-auto text-right">
                <p className="text-xs font-black text-emerald-600">{time.avgWaitMins}m wait</p>
                <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${time.score}%` }}></div>
                </div>
            </div>
        </div>
    );
};

// Main Peak Hours Analytics Component
const PeakHoursAnalytics = ({ doctorId }) => {
    const [analysis, setAnalysis] = useState(null);
    const [heatmapData, setHeatmapData] = useState(null);
    const [bestTimes, setBestTimes] = useState([]);
    const [crowdLevel, setCrowdLevel] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!doctorId) return;

        const fetchData = async () => {
            try {
                const [analysisRes, heatmapRes, bestTimesRes, crowdRes] = await Promise.all([
                    fetch(`${API}/api/analytics/doctor/${doctorId}/peak-hours`),
                    fetch(`${API}/api/analytics/doctor/${doctorId}/heatmap`),
                    fetch(`${API}/api/analytics/doctor/${doctorId}/best-times`),
                    fetch(`${API}/api/analytics/doctor/${doctorId}/crowd-level`)
                ]);

                const [analysisData, heatmapDataRes, bestTimesData, crowdData] = await Promise.all([
                    analysisRes.json(),
                    heatmapRes.json(),
                    bestTimesRes.json(),
                    crowdRes.json()
                ]);

                setAnalysis(analysisData);
                setHeatmapData(heatmapDataRes);
                setBestTimes(bestTimesData);
                setCrowdLevel(crowdData);
            } catch (err) {
                console.error('Analytics fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [doctorId]);

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
                <div className="h-20 bg-gray-100 rounded-xl"></div>
            </div>
        );
    }

    if (!analysis) return null;

        return (
        <div className="glass-card overflow-hidden border-none shadow-none">
            {/* Header */}
            <div className="p-8 border-b border-slate-100/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                            <TrendingUp size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Peak Hours Analytics</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Statistical analysis of patient engagement patterns.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-200 group"
                    >
                        {expanded ? <ChevronUp size={20} className="text-slate-400 group-hover:text-indigo-600" /> : <ChevronDown size={20} className="text-slate-400 group-hover:text-indigo-600" />}
                    </button>
                </div>
            </div>

            {/* Current Status */}
            {crowdLevel && (
                <div className={`px-8 py-4 flex items-center justify-between transition-colors duration-500 border-b border-slate-100/30 ${
                    crowdLevel.crowdLevel === 'busy' ? 'bg-rose-50/50' :
                    crowdLevel.crowdLevel === 'quiet' ? 'bg-emerald-50/50' : 'bg-indigo-50/50'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            crowdLevel.crowdLevel === 'busy' ? 'bg-rose-500 text-white animate-pulse' :
                            crowdLevel.crowdLevel === 'quiet' ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'
                        }`}>
                            <Zap size={14} fill="currentColor" />
                        </div>
                        <div>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                                crowdLevel.crowdLevel === 'busy' ? 'text-rose-600' :
                                crowdLevel.crowdLevel === 'quiet' ? 'text-emerald-600' : 'text-indigo-600'
                            }`}>
                                {crowdLevel.crowdLevel === 'busy' ? 'Peak Facility Load' :
                                 crowdLevel.crowdLevel === 'quiet' ? 'High Capacity Available' : 'Normal Clinical Activity'}
                            </span>
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white/50 px-4 py-1.5 rounded-full border border-white/80 shadow-sm">
                        {crowdLevel.patientsWaiting} PENDING • {crowdLevel.remainingToday} SLOTS REMAINING
                    </span>
                </div>
            )}

            {/* Quick Stats */}
            <div className="p-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-500/5 transition-all group">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <Sun size={20} strokeWidth={2.5} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Busiest Cycle</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">{analysis.busiestDay}</p>
                </div>
                <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-500/5 transition-all group">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-500 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <Moon size={20} strokeWidth={2.5} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Optimal Cycle</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">{analysis.quietestDay}</p>
                </div>
                <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-500/5 transition-all group">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <Clock size={20} strokeWidth={2.5} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Peak Window</p>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                        {analysis.peakHours.slice(0, 2).join(', ') || 'N/A'}
                    </p>
                </div>
                <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-500/5 transition-all group">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <Star size={20} strokeWidth={2.5} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Best Window</p>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                        {analysis.quietHours.slice(0, 2).join(', ') || 'Varied'}
                    </p>
                </div>
            </div>

            {/* Recommendation */}
            <div className="mx-8 mb-8 p-6 bg-gradient-to-r from-indigo-50 to-blue-50/50 rounded-[2rem] border border-indigo-100/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
                        <Info size={20} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Clinical Advice</p>
                        <p className="text-sm font-black text-slate-900 leading-relaxed">{analysis.recommendation}</p>
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <>
                    {/* Best Booking Times */}
                    {bestTimes.length > 0 && (
                        <div className="px-8 pb-8">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <Star className="text-amber-500" size={14} fill="currentColor" />
                                Recommended Booking Slots
                            </h4>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {bestTimes.slice(0, 6).map((time, idx) => (
                                    <BestTimeCard key={idx} time={time} rank={idx + 1} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hourly Distribution */}
                    <div className="px-8 pb-10">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Clock className="text-indigo-500" size={14} strokeWidth={2.5} />
                            Hourly Engagement Profile
                        </h4>
                        <div className="flex items-end gap-1.5 h-40 bg-slate-50/50 rounded-3xl p-6 border border-slate-100 shadow-inner">
                            {analysis.hourlyDistribution.map((hour, idx) => {
                                const maxAppts = Math.max(...analysis.hourlyDistribution.map(h => h.appointments));
                                const heightPercent = maxAppts > 0 ? (hour.appointments / maxAppts) * 100 : 10;
                                
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group/bar">
                                        <div 
                                            className={`w-full rounded-2xl transition-all duration-300 hover:scale-x-110 shadow-sm ${
                                                hour.trafficLevel === 'very-high' ? 'bg-rose-400' :
                                                hour.trafficLevel === 'high' ? 'bg-amber-400' :
                                                hour.trafficLevel === 'low' ? 'bg-emerald-400' :
                                                hour.trafficLevel === 'very-low' ? 'bg-sky-400' : 'bg-indigo-400'
                                            }`}
                                            style={{ height: `${Math.max(heightPercent, 8)}%` }}
                                            title={`${hour.displayHour}: ${hour.appointments} clinical entries`}
                                        />
                                        <span className={`text-[8px] font-black uppercase tracking-tighter transition-colors ${hour.hour % 3 === 0 ? 'text-slate-400' : 'text-transparent'}`}>
                                            {hour.hour}h
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between px-6 mt-2">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Early Shift</span>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Prime Hours</span>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Late Shift</span>
                        </div>
                    </div>

                    {/* Weekly Heatmap */}
                    {heatmapData && (
                        <div className="px-8 pb-12">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Calendar className="text-indigo-500" size={14} strokeWidth={2.5} />
                                Weekly Load Distribution Matrix
                            </h4>
                            <div className="overflow-x-auto pb-4 custom-scrollbar">
                                <div className="min-w-[650px] p-6 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                    {/* Hours header */}
                                    <div className="flex gap-1.5 mb-4 ml-24">
                                        {Array.from({ length: 16 }).map((_, i) => {
                                            const h = i + 6;
                                            return (
                                                <span key={h} className="flex-1 text-[9px] font-black text-slate-300 text-center uppercase tracking-tighter">
                                                    {h > 12 ? `${h-12}p` : h === 12 ? '12p' : `${h}a`}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {/* Grid */}
                                    {heatmapData.days.map((day, dayIdx) => (
                                        <div key={day} className="flex items-center gap-1.5 mb-1.5">
                                            <span className="w-24 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right pr-4">
                                                {day}
                                            </span>
                                            <div className="flex-1 grid grid-cols-16 gap-1.5">
                                                {heatmapData.heatmap[dayIdx].slice(6, 22).map((val, hourIdx) => (
                                                    <HeatmapCell 
                                                        key={hourIdx} 
                                                        value={val} 
                                                        maxValue={100}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Legend */}
                                    <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-slate-200/50">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Optimized Load</span>
                                        <div className="flex gap-1.5 grayscale-[0.5] opacity-80">
                                            {['bg-slate-50', 'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-400', 'bg-indigo-600'].map((bg, i) => (
                                                <div key={i} className={`w-5 h-5 rounded-lg border border-white/40 ${bg}`} />
                                            ))}
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Maximum Intensity</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PeakHoursAnalytics;
