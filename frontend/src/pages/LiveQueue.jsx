import React, { useState, useEffect } from 'react';
import { Clock, Users, Activity, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

const POLL_INTERVAL = 15_000; // 15 seconds

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

const LiveQueue = () => {
    const { user } = useAuth();
    const [queueData, setQueueData] = useState([]);
    const [queueInfo, setQueueInfo] = useState({ currentToken: 0, yourToken: 0, estimatedWaitTime: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [noQueue, setNoQueue] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

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
                    predictedDuration: data.predictedDuration || 15
                });
                setQueueData(data.queueSequence || []);
                setNoQueue(false);
                setLastUpdated(new Date());
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
