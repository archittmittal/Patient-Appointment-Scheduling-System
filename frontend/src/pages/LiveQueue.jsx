import React, { useState, useEffect } from 'react';
import { Clock, Users, Activity, CheckCircle2, AlertCircle, RefreshCw, AlertTriangle, MapPin, Navigation, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const POLL_INTERVAL = 15_000; // 15 seconds

// Issue #37: Smart Arrival Card Component
const SmartArrivalCard = ({ arrivalData }) => {
    if (!arrivalData) return null;
    
    const { 
        optimalArrivalTime, 
        earliestArrival, 
        latestArrival, 
        message, 
        confidence,
        patientsAhead,
        estimatedWaitMins
    } = arrivalData;

    // Convert 24h time to 12h format for display
    const formatTo12Hour = (time24) => {
        if (!time24) return '';
        const [hours, mins] = time24.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${hour12}:${String(mins).padStart(2, '0')} ${ampm}`;
    };

    const getConfidenceColor = (score) => {
        if (score >= 70) return 'text-green-600 bg-green-100';
        if (score >= 50) return 'text-yellow-600 bg-yellow-100';
        return 'text-orange-600 bg-orange-100';
    };

    const getConfidenceLabel = (score) => {
        if (score >= 70) return 'High';
        if (score >= 50) return 'Medium';
        return 'Low';
    };

    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 border border-emerald-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-emerald-100 rounded-xl">
                    <Sparkles className="text-emerald-600" size={20} />
                </div>
                <h4 className="font-bold text-emerald-900">Smart Arrival Time</h4>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${getConfidenceColor(confidence)}`}>
                    {getConfidenceLabel(confidence)} Confidence
                </span>
            </div>

            {/* Main Arrival Time Display */}
            <div className="bg-white rounded-2xl p-5 mb-4 text-center shadow-sm">
                <p className="text-sm text-gray-500 mb-1">Optimal Arrival Time</p>
                <div className="text-4xl font-bold text-emerald-600 mb-2">
                    {formatTo12Hour(optimalArrivalTime)}
                </div>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                    <span>Earliest: {formatTo12Hour(earliestArrival)}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span>Latest: {formatTo12Hour(latestArrival)}</span>
                </div>
            </div>

            {/* AI Message */}
            <div className="bg-white/60 rounded-xl p-4 mb-4">
                <p className="text-sm text-emerald-800 leading-relaxed">
                    <Navigation size={14} className="inline mr-1.5 text-emerald-600" />
                    {message}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/60 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{patientsAhead}</p>
                    <p className="text-xs text-gray-500">Patients Ahead</p>
                </div>
                <div className="bg-white/60 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">~{estimatedWaitMins}m</p>
                    <p className="text-xs text-gray-500">Est. Wait</p>
                </div>
            </div>

            {/* Confidence Bar */}
            <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Prediction Accuracy</span>
                    <span>{confidence}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                            confidence >= 70 ? 'bg-emerald-500' : 
                            confidence >= 50 ? 'bg-yellow-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${confidence}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

const QueueItem = ({ number, name, status, time, isCurrent }) => (
    <div className={`flex items-center p-4 rounded-xl border transition-all ${isCurrent
        ? 'bg-primary-light/30 border-primary shadow-sm scale-[1.02]'
        : status === 'COMPLETED'
            ? 'bg-gray-50 border-gray-100 opacity-75'
            : 'bg-white border-gray-100 hover:border-gray-300'
        }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${isCurrent ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-gray-100 text-gray-500'}`}>
            {number}
        </div>
        <div className="ml-4 flex-1">
            <h4 className={`font-semibold ${isCurrent ? 'text-primary' : 'text-gray-900'}`}>{name}</h4>
            <p className="text-sm text-gray-500 capitalize">{status?.toLowerCase().replace('_', ' ')}</p>
        </div>
        <div className="text-right">
            <p className="font-medium text-gray-900">{time}</p>
            {status === 'COMPLETED' && <CheckCircle2 size={16} className="text-green-500 inline-block mt-1" />}
            {isCurrent && <Activity size={16} className="text-primary inline-block mt-1 animate-pulse" />}
        </div>
    </div>
);

// Delay Alert Banner Component
const DelayBanner = ({ delayMins, reason }) => {
    if (!delayMins || delayMins < 5) return null;
    
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
                <p className="font-medium text-amber-800">
                    Doctor Running ~{delayMins} Minutes Behind Schedule
                </p>
                {reason && <p className="text-sm text-amber-600 mt-1">{reason}</p>}
                <p className="text-xs text-amber-500 mt-2">
                    Your estimated wait time has been adjusted accordingly.
                </p>
            </div>
        </div>
    );
};

const LiveQueue = () => {
    const { user } = useAuth();
    const [queueData, setQueueData] = useState([]);
    const [queueInfo, setQueueInfo] = useState({ currentToken: 0, yourToken: 0, estimatedWaitTime: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [noQueue, setNoQueue] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [delayInfo, setDelayInfo] = useState({ isDelayed: false, delayMins: 0 });
    const [todayAppointmentId, setTodayAppointmentId] = useState(null);
    
    // Issue #37: Smart arrival state
    const [smartArrival, setSmartArrival] = useState(null);

    useEffect(() => {
        if (!user?.id) return;

        const fetchQueue = async () => {
            try {
                // Get patient's most recent today's appointment
                const aptRes = await fetch(`${API}/api/patients/${user.id}/appointments`);
                const appointments = await aptRes.json();

                const todayStr = new Date().toISOString().split('T')[0];
                const todayApt = appointments.find(a => a.appointment_date?.split('T')[0] === todayStr || a.appointment_date === todayStr);

                if (!todayApt) {
                    setNoQueue(true);
                    setIsLoading(false);
                    return;
                }

                setTodayAppointmentId(todayApt.id);

                const queueRes = await fetch(`${API}/api/appointments/queue/${todayApt.id}`);
                if (!queueRes.ok) {
                    setNoQueue(true);
                    setIsLoading(false);
                    return;
                }

                const data = await queueRes.json();
                setQueueInfo({
                    currentToken: data.currentToken,
                    yourToken: data.queue_number,
                    // Use AI-predicted wait time if available, fallback to legacy estimate
                    estimatedWaitTime: data.estimatedWaitMins || data.estimated_time,
                    patientsAhead: data.patientsAhead || 0,
                    predictedDuration: data.predictedDuration || 15,
                    doctorId: data.doctor_id
                });
                setQueueData(data.queueSequence || []);
                setNoQueue(false);
                setLastUpdated(new Date());

                // Fetch delay status for the doctor (Issue #40)
                if (data.doctor_id) {
                    try {
                        const delayRes = await fetch(`${API}/api/doctors/${data.doctor_id}/delay-status`);
                        if (delayRes.ok) {
                            const delayData = await delayRes.json();
                            setDelayInfo({
                                isDelayed: delayData.isDelayed || delayData.effectiveDelay > 5,
                                delayMins: delayData.effectiveDelay || delayData.delayMins || 0,
                                reason: delayData.manualDelay?.reason || ''
                            });
                        }
                    } catch (delayErr) {
                        console.error('Error fetching delay status:', delayErr);
                    }
                }

                // Issue #37: Fetch smart arrival time
                try {
                    const smartRes = await fetch(`${API}/api/appointments/${todayApt.id}/smart-arrival`, {
                        headers: authedHeaders()
                    });
                    if (smartRes.ok) {
                        const smartData = await smartRes.json();
                        setSmartArrival(smartData);
                    }
                } catch (err) {
                    console.error('Smart arrival fetch error:', err);
                }
            } catch (err) {
                console.error('Error fetching queue:', err);
                setNoQueue(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQueue();
        const interval = setInterval(fetchQueue, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [user?.id]);

    if (isLoading) {
        return <div className="max-w-4xl mx-auto p-10 text-center font-medium text-gray-500">Loading live queue...</div>;
    }

    if (noQueue) {
        return (
            <div className="max-w-4xl mx-auto p-10 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
                <Clock size={48} className="text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-700 mb-2">No Active Queue</h2>
                <p className="text-gray-500">You don't have an appointment today. Book an appointment to see your queue status.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        Live Queue Tracking
                        <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    </h1>
                    <p className="text-gray-500 mt-1">Real-time updates for your appointment today.</p>
                </div>
                {lastUpdated && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <RefreshCw size={12} />
                        Updated {lastUpdated.toLocaleTimeString()}
                    </div>
                )}
            </div>

            {/* Delay Alert Banner - Issue #40 */}
            <DelayBanner delayMins={delayInfo.delayMins} reason={delayInfo.reason} />

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-primary to-primary-hover rounded-3xl p-8 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-primary-light font-medium mb-1">Current Token</p>
                                <h2 className="text-6xl font-bold">{queueInfo.currentToken || '—'}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-primary-light font-medium mb-1">Your Token</p>
                                <h2 className="text-4xl font-bold text-white/90">{queueInfo.yourToken}</h2>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/20 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-white/70 text-sm mb-1">Estimated Wait Time</p>
                                <p className="text-xl font-semibold flex items-center gap-2">
                                    <Clock size={20} /> ~{queueInfo.estimatedWaitTime} mins
                                </p>
                                <p className="text-white/50 text-xs mt-1">AI-powered prediction</p>
                            </div>
                            <div>
                                <p className="text-white/70 text-sm mb-1">People Ahead of You</p>
                                <p className="text-xl font-semibold flex items-center gap-2">
                                    <Users size={20} /> {queueInfo.patientsAhead ?? Math.max(0, queueInfo.yourToken - (queueInfo.currentToken || 0) - 1)} People
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Users className="text-primary" /> Queue Sequence
                            </h3>
                            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {queueData.length} Total
                            </span>
                        </div>
                        <div className="space-y-3">
                            {queueData.map(item => (
                                <QueueItem key={item.queue_id || item.number} {...item} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Issue #37: Smart Arrival Time Card */}
                    {smartArrival && <SmartArrivalCard arrivalData={smartArrival} />}
                    
                    <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100">
                        <div className="flex items-start gap-4">
                            <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-orange-900 mb-2">Important Instructions</h4>
                                <ul className="space-y-3 text-sm text-orange-800 list-disc list-inside">
                                    <li>Arrive at least 15 minutes before your estimated time.</li>
                                    <li>If you miss your turn, you will be moved down 3 places.</li>
                                    <li>Keep your ID and medical records handy.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveQueue;
