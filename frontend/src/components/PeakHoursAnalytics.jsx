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
        'very-high': { label: 'Very Busy', color: 'bg-red-100 text-red-700', icon: TrendingUp },
        'high': { label: 'Busy', color: 'bg-orange-100 text-orange-700', icon: TrendingUp },
        'normal': { label: 'Normal', color: 'bg-blue-100 text-blue-700', icon: Users },
        'low': { label: 'Quiet', color: 'bg-green-100 text-green-700', icon: TrendingDown },
        'very-low': { label: 'Very Quiet', color: 'bg-emerald-100 text-emerald-700', icon: Star }
    };
    
    const cfg = config[level] || config.normal;
    const Icon = cfg.icon;
    
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
};

// Heatmap cell
const HeatmapCell = ({ value, maxValue }) => {
    const intensity = value / maxValue;
    let bgClass = 'bg-gray-50';
    
    if (intensity > 0.8) bgClass = 'bg-red-400';
    else if (intensity > 0.6) bgClass = 'bg-orange-300';
    else if (intensity > 0.4) bgClass = 'bg-yellow-200';
    else if (intensity > 0.2) bgClass = 'bg-green-100';
    else if (intensity > 0) bgClass = 'bg-emerald-50';
    
    return (
        <div 
            className={`w-full aspect-square rounded-sm ${bgClass} transition-all hover:scale-110`}
            title={`${value}% of max`}
        />
    );
};

// Time slot recommendation card
const BestTimeCard = ({ time, rank }) => {
    const medals = ['🥇', '🥈', '🥉'];
    
    return (
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary/30 transition-colors">
            <span className="text-xl">{medals[rank - 1] || `#${rank}`}</span>
            <div>
                <p className="font-semibold text-gray-900">{time.day}</p>
                <p className="text-sm text-gray-500">{time.time}</p>
            </div>
            <div className="ml-auto text-right">
                <p className="text-sm font-medium text-emerald-600">~{time.avgWaitMins}m wait</p>
                <p className="text-xs text-gray-400">{time.score}/100 score</p>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Peak Hours Analytics</h3>
                            <p className="text-xs text-gray-500">Best times to book your appointment</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>
            </div>

            {/* Current Status */}
            {crowdLevel && (
                <div className={`px-5 py-3 flex items-center justify-between ${
                    crowdLevel.crowdLevel === 'busy' ? 'bg-red-50' :
                    crowdLevel.crowdLevel === 'quiet' ? 'bg-green-50' : 'bg-blue-50'
                }`}>
                    <div className="flex items-center gap-2">
                        <Zap size={16} className={
                            crowdLevel.crowdLevel === 'busy' ? 'text-red-500' :
                            crowdLevel.crowdLevel === 'quiet' ? 'text-green-500' : 'text-blue-500'
                        } />
                        <span className="text-sm font-medium">
                            {crowdLevel.crowdLevel === 'busy' ? 'Currently Busy' :
                             crowdLevel.crowdLevel === 'quiet' ? 'Quiet Right Now' : 'Normal Activity'}
                        </span>
                    </div>
                    <span className="text-xs text-gray-500">
                        {crowdLevel.patientsWaiting} waiting • {crowdLevel.remainingToday} remaining today
                    </span>
                </div>
            )}

            {/* Quick Stats */}
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-orange-50 rounded-xl">
                    <Sun size={18} className="text-orange-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Busiest Day</p>
                    <p className="font-semibold text-gray-900">{analysis.busiestDay}</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                    <Moon size={18} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Quietest Day</p>
                    <p className="font-semibold text-gray-900">{analysis.quietestDay}</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                    <Clock size={18} className="text-red-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Peak Hours</p>
                    <p className="font-semibold text-gray-900 text-sm">
                        {analysis.peakHours.slice(0, 2).join(', ') || 'None'}
                    </p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                    <Star size={18} className="text-green-500 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Best Hours</p>
                    <p className="font-semibold text-gray-900 text-sm">
                        {analysis.quietHours.slice(0, 2).join(', ') || 'Varies'}
                    </p>
                </div>
            </div>

            {/* Recommendation */}
            <div className="mx-5 mb-5 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="flex items-start gap-3">
                    <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900">{analysis.recommendation}</p>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <>
                    {/* Best Booking Times */}
                    {bestTimes.length > 0 && (
                        <div className="px-5 pb-5">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <Star className="text-yellow-500" size={16} />
                                Best Times to Book
                            </h4>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {bestTimes.slice(0, 6).map((time, idx) => (
                                    <BestTimeCard key={idx} time={time} rank={idx + 1} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hourly Distribution */}
                    <div className="px-5 pb-5">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Clock className="text-primary" size={16} />
                            Hourly Traffic
                        </h4>
                        <div className="flex items-end gap-1 h-32 bg-gray-50 rounded-xl p-3">
                            {analysis.hourlyDistribution.map((hour, idx) => {
                                const maxAppts = Math.max(...analysis.hourlyDistribution.map(h => h.appointments));
                                const heightPercent = maxAppts > 0 ? (hour.appointments / maxAppts) * 100 : 10;
                                
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                        <div 
                                            className={`w-full rounded-t transition-all hover:opacity-80 ${
                                                hour.trafficLevel === 'very-high' ? 'bg-red-400' :
                                                hour.trafficLevel === 'high' ? 'bg-orange-400' :
                                                hour.trafficLevel === 'low' ? 'bg-green-400' :
                                                hour.trafficLevel === 'very-low' ? 'bg-emerald-400' : 'bg-blue-400'
                                            }`}
                                            style={{ height: `${Math.max(heightPercent, 5)}%` }}
                                            title={`${hour.displayHour}: ${hour.appointments} appointments`}
                                        />
                                        <span className="text-[10px] text-gray-400">
                                            {hour.hour % 3 === 0 ? hour.hour : ''}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>6 AM</span>
                            <span>12 PM</span>
                            <span>6 PM</span>
                        </div>
                    </div>

                    {/* Weekly Heatmap */}
                    {heatmapData && (
                        <div className="px-5 pb-5">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <Calendar className="text-primary" size={16} />
                                Weekly Heatmap
                            </h4>
                            <div className="overflow-x-auto">
                                <div className="min-w-[500px]">
                                    {/* Hours header */}
                                    <div className="flex gap-0.5 mb-1 ml-16">
                                        {[6, 9, 12, 15, 18, 21].map(h => (
                                            <span key={h} className="flex-1 text-[10px] text-gray-400 text-center">
                                                {h > 12 ? `${h-12}PM` : h === 12 ? '12PM' : `${h}AM`}
                                            </span>
                                        ))}
                                    </div>
                                    {/* Grid */}
                                    {heatmapData.days.map((day, dayIdx) => (
                                        <div key={day} className="flex items-center gap-0.5 mb-0.5">
                                            <span className="w-16 text-xs text-gray-500 text-right pr-2">
                                                {day.slice(0, 3)}
                                            </span>
                                            <div className="flex-1 grid grid-cols-12 gap-0.5">
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
                                    <div className="flex items-center justify-end gap-2 mt-3">
                                        <span className="text-xs text-gray-400">Less busy</span>
                                        <div className="flex gap-0.5">
                                            {['bg-gray-50', 'bg-emerald-50', 'bg-green-100', 'bg-yellow-200', 'bg-orange-300', 'bg-red-400'].map((bg, i) => (
                                                <div key={i} className={`w-4 h-4 rounded-sm ${bg}`} />
                                            ))}
                                        </div>
                                        <span className="text-xs text-gray-400">More busy</span>
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
