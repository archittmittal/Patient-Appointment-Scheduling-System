import React, { useState, useEffect } from 'react';
import { 
    Clock, TrendingUp, TrendingDown, Calendar, Users, 
    Zap, Sun, Moon, Star, Info, ChevronDown, ChevronUp 
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

// Traffic level badge component
const TrafficBadge = ({ level }) => {
    const config = {
        'very-high': { label: 'Peak Capacity', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', icon: TrendingUp },
        'high': { label: 'High Demand', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: TrendingUp },
        'normal': { label: 'Steady Flow', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', icon: Users },
        'low': { label: 'High Availability', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: TrendingDown },
        'very-low': { label: 'Optimal Booking', color: 'bg-primary/10 text-primary border-primary/20', icon: Star }
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
    let bgClass = 'bg-white/5 dark:bg-white/5';
    
    if (intensity > 0.8) bgClass = 'bg-primary shadow-[0_0_15px_rgba(79,70,229,0.4)]';
    else if (intensity > 0.6) bgClass = 'bg-primary/80';
    else if (intensity > 0.4) bgClass = 'bg-primary/60';
    else if (intensity > 0.2) bgClass = 'bg-primary/40';
    else if (intensity > 0) bgClass = 'bg-primary/20';
    
    return (
        <div 
            className={`w-full aspect-square rounded-lg ${bgClass} transition-all duration-300 hover:scale-125 hover:z-10 cursor-pointer border border-white/10`}
            title={`${value}% of max clinical load`}
        />
    );
};

// Time slot recommendation card
const BestTimeCard = ({ time, rank }) => {
    const medals = ['🥇', '🥈', '🥉'];
    
    return (
        <div className="flex items-center gap-4 p-5 glass-card border-[var(--border-base)] hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                {medals[rank - 1] || rank}
            </div>
            <div>
                <p className="text-sm font-black text-[var(--text-base)] tracking-tight">{time.day}</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{time.time}</p>
            </div>
            <div className="ml-auto text-right">
                <p className="text-xs font-black text-emerald-500">{time.avgWaitMins}m wait</p>
                <div className="w-16 h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${time.score}%` }}></div>
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
                const [analysisData, heatmapData, bestTimesData, crowdData] = await Promise.all([
                    apiClient.get(`/api/analytics/doctor/${doctorId}/peak-hours`),
                    apiClient.get(`/api/analytics/doctor/${doctorId}/heatmap`),
                    apiClient.get(`/api/analytics/doctor/${doctorId}/best-times`),
                    apiClient.get(`/api/analytics/doctor/${doctorId}/crowd-level`)
                ]);

                if (analysisData && !analysisData.error) setAnalysis(analysisData);
                if (heatmapData && !heatmapData.error) setHeatmapData(heatmapData);
                if (bestTimesData && !bestTimesData.error) setBestTimes(bestTimesData);
                if (crowdData && !crowdData.error) setCrowdLevel(crowdData);
            } catch (err) {
                console.error('Analytics fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [doctorId]);

    if (isLoading) return <div className="p-10 glass-card animate-pulse text-center font-bold text-slate-500">Decrypting Clinical Patterns...</div>;
    if (!analysis) return null;

    return (
        <div className="glass-card overflow-hidden border-none shadow-none bg-transparent">
            {/* Header */}
            <div className="p-8 border-b border-[var(--border-base)]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                            <TrendingUp size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-base)] tracking-tight uppercase">Performance Intelligence</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Statistical patient engagement profiling</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="btn-secondary p-2.5 rounded-xl border-[var(--border-base)]"
                    >
                        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
            </div>

            {/* Current Status */}
            {crowdLevel && (
                <div className={`px-8 py-4 flex items-center justify-between transition-colors duration-500 border-b border-[var(--border-base)] ${
                    crowdLevel.crowdLevel === 'busy' ? 'bg-rose-500/5' :
                    crowdLevel.crowdLevel === 'quiet' ? 'bg-emerald-500/5' : 'bg-primary/5'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            crowdLevel.crowdLevel === 'busy' ? 'bg-rose-500 text-white animate-pulse' :
                            crowdLevel.crowdLevel === 'quiet' ? 'bg-emerald-500 text-white' : 'bg-primary text-white'
                        }`}>
                            <Zap size={14} fill="currentColor" />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                            crowdLevel.crowdLevel === 'busy' ? 'text-rose-500' :
                            crowdLevel.crowdLevel === 'quiet' ? 'text-emerald-500' : 'text-primary'
                        }`}>
                            {crowdLevel.crowdLevel === 'busy' ? 'Peak Ops Load' :
                             crowdLevel.crowdLevel === 'quiet' ? 'High Capacity' : 'Normal Flow'}
                        </span>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-full border border-[var(--border-base)]">
                        {crowdLevel.patientsWaiting} PENDING • {crowdLevel.remainingToday} SLOTS
                    </span>
                </div>
            )}

            {/* Quick Stats Grid */}
            <div className="p-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
                <QuickStat icon={<Sun />} label="Busiest Shift" value={analysis.busiestDay} color="amber" />
                <QuickStat icon={<Moon />} label="Optimal Shift" value={analysis.quietestDay} color="indigo" />
                <QuickStat icon={<Clock />} label="Peak Window" value={analysis.peakHours.slice(0, 1).join('') || 'N/A'} color="rose" />
                <QuickStat icon={<Star />} label="Best Capture" value={analysis.quietHours.slice(0, 1).join('') || 'Varied'} color="emerald" />
            </div>

            {/* Recommendation Alert */}
            <div className="mx-8 mb-8 p-6 bg-gradient-to-r from-primary/10 to-transparent rounded-[2.5rem] border border-primary/10 relative overflow-hidden group">
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                        <Info size={20} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Efficiency Recommendation</p>
                        <p className="text-sm font-black text-[var(--text-base)] leading-relaxed ">"{analysis.recommendation}"</p>
                    </div>
                </div>
            </div>

            {/* Expanded Analytics */}
            {expanded && (
                <div className="animate-in slide-in-from-top-4 duration-500">
                    {/* Time Recommendation Grid */}
                    {bestTimes.length > 0 && (
                        <div className="px-8 pb-8">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <Star className="text-amber-500" size={14} fill="currentColor" />
                                Recommended Booking Slots
                            </h4>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {bestTimes.slice(0, 3).map((time, idx) => (
                                    <BestTimeCard key={idx} time={time} rank={idx + 1} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hourly Distribution Bar Chart */}
                    <div className="px-8 pb-10">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Clock className="text-primary" size={14} strokeWidth={2.5} />
                            Hourly Engagement Profile
                        </h4>
                        <div className="flex items-end gap-2 h-40 bg-white/5 rounded-[3rem] p-8 border border-[var(--border-base)] shadow-inner overflow-hidden">
                            {analysis.hourlyDistribution.map((hour, idx) => {
                                const maxAppts = Math.max(...analysis.hourlyDistribution.map(h => h.appointments));
                                const heightPercent = maxAppts > 0 ? (hour.appointments / maxAppts) * 100 : 10;
                                
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group/bar">
                                        <div 
                                            className={`w-full rounded-full transition-all duration-300 hover:opacity-100 ${
                                                hour.trafficLevel === 'very-high' ? 'bg-rose-500' :
                                                hour.trafficLevel === 'high' ? 'bg-amber-500' :
                                                hour.trafficLevel === 'low' ? 'bg-emerald-500' :
                                                hour.trafficLevel === 'very-low' ? 'bg-primary' : 'bg-indigo-500'
                                            } ${heightPercent < 50 ? 'opacity-40' : 'opacity-80'}`}
                                            style={{ height: `${Math.max(heightPercent, 12)}%` }}
                                        />
                                        <span className={`text-[8px] font-black text-slate-500 transition-opacity ${hour.hour % 4 === 0 ? 'opacity-100' : 'opacity-0'}`}>
                                            {hour.hour}h
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Weekly Heatmap Matrix */}
                    {heatmapData && (
                        <div className="px-8 pb-12">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Calendar className="text-primary" size={14} strokeWidth={2.5} />
                                Weekly Load Distribution Matrix
                            </h4>
                            <div className="overflow-x-auto pb-4 custom-scrollbar">
                                <div className="min-w-[650px] p-8 bg-white/5 rounded-[3rem] border border-[var(--border-base)] shadow-inner">
                                    <div className="flex gap-1.5 mb-6 ml-24">
                                        {Array.from({ length: 16 }).map((_, i) => {
                                            const h = i + 6;
                                            return (
                                                <span key={h} className="flex-1 text-[9px] font-black text-slate-400 text-center uppercase tracking-widest">
                                                    {h > 12 ? `${h-12}p` : h === 12 ? '12p' : `${h}a`}
                                                </span>
                                            );
                                        })}
                                    </div>
                                    {heatmapData.days.map((day, dayIdx) => (
                                        <div key={day} className="flex items-center gap-2 mb-2">
                                            <span className="w-20 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right pr-4">{day}</span>
                                            <div className="flex-1 grid grid-cols-16 gap-2">
                                                {heatmapData.heatmap[dayIdx].slice(6, 22).map((val, hourIdx) => (
                                                    <HeatmapCell key={hourIdx} value={val} maxValue={100} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const QuickStat = ({ icon, label, value, color }) => (
    <div className="p-6 glass-card border-[var(--border-base)] hover:border-primary/20 hover:translate-y-[-4px] transition-all group">
        <div className={`w-10 h-10 bg-${color}-500/10 rounded-xl flex items-center justify-center text-${color}-500 mb-4 shadow-inner group-hover:scale-110 transition-transform`}>
            {React.cloneElement(icon, { size: 20, strokeWidth: 2.5 })}
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">{label}</p>
        <p className="text-lg font-black text-[var(--text-base)] tracking-tight">{value}</p>
    </div>
);

export default PeakHoursAnalytics;
