/**
 * Issue #40: Live Queue Management - PREMIUM OVERHAUL & STABILIZATION
 * Throughput Telemetry Stream for real-time clinical monitoring.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Clock, Users, Activity, CheckCircle2, AlertCircle, RefreshCw, 
    AlertTriangle, MapPin, Navigation, Sparkles, ChevronRight, 
    Activity as PulseIcon, Target, Zap, ShieldCheck, Timer,
    Radio, Info, Compass
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { sseService } from '../services/sseService';

const FALLBACK_POLL = 60_000; // Minimal fallback polling

const SmartArrivalCard = ({ arrivalData }) => {
    if (!arrivalData) return null;
    const { optimalArrivalTime, earliestArrival, latestArrival, message, confidence, patientsAhead, estimatedWaitMins } = arrivalData;

    const formatTo12Hour = (time24) => {
        if (!time24) return '';
        try {
            const [hours, mins] = time24.split(':').map(Number);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            return `${hours % 12 || 12}:${String(mins).padStart(2, '0')} ${ampm}`;
        } catch (e) {
            return time24;
        }
    };

    return (
        <div className="glass-card bg-emerald-500/5 p-10 border-none group hover:shadow-2xl transition-all duration-1000 relative overflow-hidden rounded-[3.5rem]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
            <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                    <Sparkles size={28} strokeWidth={2.5} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-emerald-600 uppercase tracking-[0.4em] leading-none ">Smart Arrival</h4>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2 opacity-60">{confidence || 95}% Confidence Index</p>
                </div>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10 mb-8 text-center shadow-inner group-hover:bg-white/10 transition-all duration-700">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] mb-4 opacity-60 ">Clinical Entry Window</p>
                <div className="text-6xl font-black text-emerald-500 tracking-tighter uppercase group-hover:scale-105 transition-transform duration-1000 tabular-nums">
                    {formatTo12Hour(optimalArrivalTime)}
                </div>
                <div className="flex items-center justify-center gap-6 text-[9px] font-black text-slate-600 uppercase tracking-widest mt-6 ">
                    <span className="bg-white/5 px-3 py-1 rounded-full border border-white/5">EARLIEST {formatTo12Hour(earliestArrival)}</span>
                    <span className="w-1.5 h-1.5 bg-emerald-500/30 rounded-full"></span>
                    <span className="bg-white/5 px-3 py-1 rounded-full border border-white/5">LATEST {formatTo12Hour(latestArrival)}</span>
                </div>
            </div>

            <div className="bg-emerald-500/5 rounded-3xl p-6 mb-8 border border-emerald-500/10 relative group-hover:bg-emerald-500/10 transition-all duration-700">
                <p className="text-[10px] font-bold text-emerald-600/80 leading-relaxed flex items-start gap-4 uppercase tracking-widest">
                    <Navigation size={18} className="flex-shrink-0 mt-0.5 animate-pulse" />
                    {message}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <StatSimple value={patientsAhead || 0} label="Line Gap" color="emerald" />
                <StatSimple value={`~${estimatedWaitMins || 0}M`} label="Wait Time" color="emerald" />
            </div>
        </div>
    );
};

const StatSimple = ({ value, label, color }) => (
    <div className="bg-white/5 border border-white/5 rounded-3xl p-6 text-center shadow-inner group-hover:border-emerald-500/20 transition-all duration-700">
        <p className={`text-3xl font-black text-${color}-500 tracking-tighter tabular-nums leading-none mb-3`}>{value}</p>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] opacity-60">{label}</p>
    </div>
);

const QueueItem = ({ number, name, status, time, isCurrent }) => (
    <div className={`flex items-center p-6 rounded-[2.5rem] border transition-all duration-700 group relative overflow-hidden ${isCurrent
        ? 'bg-primary/5 border-primary shadow-2xl shadow-primary/10 scale-[1.02]'
        : status === 'COMPLETED'
            ? 'opacity-40 grayscale border-white/5 bg-white/5'
            : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
        }`}>
        {isCurrent && <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>}
        
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 border transition-all duration-700 relative z-10 ${isCurrent ? 'bg-primary text-white border-primary-light/20 shadow-2xl shadow-primary/30 rotate-3 group-hover:rotate-0' : 'bg-white/5 text-slate-700 border-white/10 group-hover:border-white/20'}`}>
            {number}
        </div>
        <div className="ml-6 flex-1 space-y-2 relative z-10">
            <h4 className={`text-sm font-black uppercase tracking-tight transition-colors ${isCurrent ? 'text-[var(--text-base)]' : 'text-slate-500 group-hover:text-slate-400'}`}>{name}</h4>
            <div className="flex items-center gap-2">
                <span className={`text-[8px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full border transition-all duration-700 ${isCurrent ? 'bg-primary/20 border-primary/20 text-primary shadow-inner' : status === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-white/5 border-white/10 text-slate-600'}`}>
                    {status?.replace('_', ' ') || 'ACTIVE'}
                </span>
            </div>
        </div>
        <div className="text-right space-y-2 relative z-10">
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isCurrent ? 'text-primary' : 'text-slate-600'}`}>{time || '--:--'}</p>
            {isCurrent && <Activity size={18} className="text-primary inline-block animate-pulse ml-auto" />}
            {status === 'COMPLETED' && <CheckCircle2 size={18} className="text-emerald-500 inline-block ml-auto" />}
        </div>
    </div>
);

const DelayBanner = ({ delayMins, reason }) => delayMins >= 5 && (
    <div className="glass-modal bg-rose-500/5 border-none rounded-[3.5rem] p-10 flex items-start gap-8 relative overflow-hidden group animate-in slide-in-from-top-10 duration-1000 shadow-2xl shadow-rose-500/5">
        <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="p-5 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-500 shadow-inner rotate-3 group-hover:rotate-0 transition-transform duration-700">
            <AlertTriangle size={32} strokeWidth={2.5} />
        </div>
        <div className="flex-1 space-y-4">
            <p className="text-lg font-black text-[var(--text-base)] uppercase tracking-tight ">Clinical Lag Detected (~{delayMins}M)</p>
            {reason && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] opacity-60 leading-relaxed">{reason}</p>}
            <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.4em] bg-rose-500/10 px-4 py-2 rounded-full w-fit border border-rose-500/20 animate-pulse">Automatic Synchronization in Progress</p>
        </div>
    </div>
);

const LiveQueue = () => {
    const { user } = useAuth();
    const [queueData, setQueueData] = useState([]);
    const [queueInfo, setQueueInfo] = useState({ currentToken: 0, yourToken: 0, estimatedWaitTime: 0, virtualCheckinStatus: 'NOT_CHECKED_IN' });
    const [isLoading, setIsLoading] = useState(true);
    const [noQueue, setNoQueue] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [delayInfo, setDelayInfo] = useState({ isDelayed: false, delayMins: 0 });
    const [smartArrival, setSmartArrival] = useState(null);

    const [checkinForm, setCheckinForm] = useState({
        etaMinutes: 30,
        bp_sys: '',
        bp_dia: '',
        heart_rate: '',
        temp_c: ''
    });
    const [checkingIn, setCheckingIn] = useState(false);

    const handleCheckIn = async (e) => {
        e.preventDefault();
        if (!queueInfo.appointmentId) return;
        setCheckingIn(true);
        try {
            const hasVitals = checkinForm.bp_sys || checkinForm.bp_dia || checkinForm.heart_rate || checkinForm.temp_c;
            const vitalsPayload = hasVitals ? {
                blood_pressure_sys: checkinForm.bp_sys ? parseInt(checkinForm.bp_sys) : null,
                blood_pressure_dia: checkinForm.bp_dia ? parseInt(checkinForm.bp_dia) : null,
                heart_rate: checkinForm.heart_rate ? parseInt(checkinForm.heart_rate) : null,
                temperature_c: checkinForm.temp_c ? parseFloat(checkinForm.temp_c) : null
            } : null;

            await apiClient.post(`/api/virtual-checkin/${queueInfo.appointmentId}/checkin`, {
                etaMinutes: parseInt(checkinForm.etaMinutes) || 30,
                device: 'web',
                vitals: vitalsPayload
            });

            await fetchQueue();
        } catch (err) {
            console.error('Failed virtual check-in:', err);
            alert(err.message || 'Check-in failed');
        } finally {
            setCheckingIn(false);
        }
    };

    const fetchQueue = useCallback(async () => {
        if (!user?.id) return;
        try {
            // Get today's appointments for this patient
            const appsResponse = await apiClient.get(`/api/patients/${user.id}/appointments`);
            const apps = appsResponse && appsResponse.data ? appsResponse.data : (Array.isArray(appsResponse) ? appsResponse : []);
            
            if (!Array.isArray(apps) || apps.length === 0) {
                setNoQueue(true);
                setIsLoading(false);
                return;
            }

            const todayStr = new Date().toISOString().split('T')[0];
            const todayApt = apps.find(a => {
                const d = a.appointment_date?.split('T')[0] || a.appointment_date;
                return d === todayStr;
            });

            if (!todayApt) { 
                setNoQueue(true); 
                setIsLoading(false); 
                return; 
            }

            // Get queue details for this today's appointment
            const data = await apiClient.get(`/api/appointments/queue/${todayApt.id}`);
            
            if (data && data.queue_number !== undefined) {
                setQueueInfo({ 
                    currentToken: data.currentToken || 0, 
                    yourToken: data.queue_number, 
                    estimatedWaitTime: data.estimatedWaitMins || data.estimated_time || 0, 
                    patientsAhead: data.patientsAhead || 0, 
                    predictedDuration: data.predictedDuration || 15, 
                    doctorId: data.doctor_id,
                    appointmentId: todayApt.id,
                    virtualCheckinStatus: data.virtual_checkin_status || 'NOT_CHECKED_IN'
                });
                setQueueData(Array.isArray(data.queueSequence) ? data.queueSequence : []);
                setNoQueue(false);
                setLastUpdated(new Date());

                // Check for doctor delays
                if (data.doctor_id) {
                    const dData = await apiClient.get(`/api/doctors/${data.doctor_id}/delay-status`);
                    setDelayInfo({ 
                        isDelayed: dData.isDelayed || (dData.effectiveDelay > 5), 
                        delayMins: dData.effectiveDelay || 0, 
                        reason: dData.manualDelay?.reason || '' 
                    });
                }

                // Get smart arrival if available
                const sData = await apiClient.get(`/api/appointments/${todayApt.id}/smart-arrival`, null);
                if (sData) setSmartArrival(sData);
            } else {
                setNoQueue(true);
            }
        } catch (err) { 
            console.error('[Queue] Telemetry drop:', err); 
            setNoQueue(true); 
        } finally { 
            setIsLoading(false); 
        }
    }, [user?.id]);

    useEffect(() => {
        fetchQueue();
        const t = setInterval(fetchQueue, FALLBACK_POLL);
        return () => clearInterval(t);
    }, [fetchQueue]);

    useEffect(() => {
        const aptId = queueData.find(item => item.isCurrent)?.appointment_id || 
                     (queueData.length > 0 ? queueData[0].appointment_id : null);

        if (!aptId) return;

        sseService.connect(
            aptId,
            (data) => {
                if (data.refresh) {
                    setLastUpdated(new Date());
                    fetchQueue();
                } else {
                    setLastUpdated(new Date());
                }
            },
            () => console.warn('[Queue] Stream Interrupted')
        );

        return () => sseService.disconnect();
    }, [queueData, fetchQueue]);

    if (isLoading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-20 space-y-8 animate-in fade-in duration-1000">
             <div className="w-24 h-24 border-8 border-primary/10 border-t-primary rounded-full animate-spin"></div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Synchronizing Throughput Feed...</p>
        </div>
    );

    if (noQueue) return (
        <div className="max-w-4xl mx-auto py-32 text-center glass-modal rounded-[4rem] border-none shadow-2xl space-y-10 group animate-in zoom-in-95 duration-700">
            <Compass size={64} className="text-slate-700/20 mx-auto group-hover:scale-110 transition-transform duration-700" />
            <div className="space-y-4">
                <h3 className="text-2xl font-black text-slate-500 uppercase tracking-tighter">Registry Silent</h3>
                <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] opacity-60">No active queue nodes detected for the current session cycle.</p>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="px-10 py-5 bg-white/5 border border-white/10 rounded-[2rem] text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] hover:bg-primary hover:text-white transition-all shadow-inner"
            >
                Refresh Registry Sync
            </button>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000 px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6 group">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 transition-transform duration-700">
                        <PulseIcon size={36} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none flex items-center gap-6">
                            Live Stream 
                            <div className="flex h-4 w-4 relative">
                                <div className="animate-ping absolute h-full w-full rounded-full bg-rose-500 opacity-75"></div>
                                <div className="relative h-4 w-4 rounded-full bg-rose-500 border border-rose-400/20"></div>
                            </div>
                        </h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 leading-none opacity-60">Real-time clinical throughput telemetry cluster</p>
                    </div>
                </div>
                {lastUpdated && (
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 bg-white/5 px-8 py-3 rounded-full border border-white/5 uppercase tracking-[0.2em] shadow-inner">
                        <RefreshCw size={16} className="animate-spin-slow text-primary" /> SYNCED {lastUpdated.toLocaleTimeString()}
                    </div>
                )}
            </div>

            <DelayBanner delayMins={delayInfo.delayMins} reason={delayInfo.reason} />

            <div className="grid lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-12">
                    {queueInfo.virtualCheckinStatus === 'NOT_CHECKED_IN' ? (
                        <div className="glass-modal rounded-[4rem] p-12 bg-white/5 border border-white/5 shadow-2xl relative overflow-hidden group transition-all duration-1000">
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
                            <h2 className="text-3xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none mb-4 flex items-center gap-4">
                                <Sparkles size={28} className="text-primary animate-pulse" /> Virtual Check-In
                            </h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-8">
                                Please pre-submit or confirm your current vitals and ETA to join the virtual waiting room.
                            </p>

                            <form onSubmit={handleCheckIn} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-2">Systolic BP (mmHg)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 120"
                                            value={checkinForm.bp_sys}
                                            onChange={e => setCheckinForm({ ...checkinForm, bp_sys: e.target.value })}
                                            className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-2">Diastolic BP (mmHg)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 80"
                                            value={checkinForm.bp_dia}
                                            onChange={e => setCheckinForm({ ...checkinForm, bp_dia: e.target.value })}
                                            className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-2">Heart Rate (bpm)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 72"
                                            value={checkinForm.heart_rate}
                                            onChange={e => setCheckinForm({ ...checkinForm, heart_rate: e.target.value })}
                                            className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-2">Temperature (°C)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="e.g. 36.5"
                                            value={checkinForm.temp_c}
                                            onChange={e => setCheckinForm({ ...checkinForm, temp_c: e.target.value })}
                                            className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3 pt-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-2">Estimated Arrival Time (Minutes from now)</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="e.g. 30"
                                        value={checkinForm.etaMinutes}
                                        onChange={e => setCheckinForm({ ...checkinForm, etaMinutes: e.target.value })}
                                        className="w-full p-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={checkingIn}
                                    className="w-full py-6 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 disabled:opacity-50"
                                >
                                    {checkingIn ? 'Processing Check-In...' : 'Confirm Vitals & Join Waiting Room'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="glass-modal rounded-[4rem] p-12 bg-primary border-none shadow-2xl relative overflow-hidden group transition-all duration-1000 hover:shadow-primary/30">
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
                            <div className="flex flex-col md:flex-row justify-between items-center md:items-start text-center md:text-left gap-10 relative z-10">
                                <div className="space-y-4">
                                    <p className="text-[11px] font-black text-primary-light uppercase tracking-[0.6em] opacity-80 leading-none">ACTIVE NODE</p>
                                    <h2 className="text-9xl font-black text-white tracking-tighter uppercase leading-none tabular-nums shadow-text">{queueInfo.currentToken || '—'}</h2>
                                    <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em] mt-8 flex items-center gap-3 justify-center md:justify-start leading-none">
                                        <Activity size={14} className="animate-pulse" /> Clinical Throughput Active
                                    </p>
                                </div>
                                <div className="flex flex-col items-center md:items-end gap-3 pt-4">
                                    <p className="text-[11px] font-black text-primary-light uppercase tracking-[0.6em] opacity-80 leading-none">YOUR INDEX</p>
                                    <h2 className="text-7xl font-black text-white/90 tracking-tighter uppercase leading-none tabular-nums">{queueInfo.yourToken}</h2>
                                    <div className="mt-6 px-6 py-2 bg-white/10 rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-[0.3em] shadow-inner">Index Verified</div>
                                </div>
                            </div>

                            <div className="mt-16 pt-12 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                                <div className="space-y-6 group/sub">
                                    <p className="text-[10px] font-black text-primary-light uppercase tracking-[0.5em] leading-none opacity-80">Estimated Sync Time</p>
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-[1.75rem] bg-white/10 border border-white/10 flex items-center justify-center text-white shadow-2xl group-hover/sub:rotate-12 transition-transform duration-700"><Timer size={28} /></div>
                                        <div>
                                            <p className="text-4xl font-black text-white tracking-tighter uppercase leading-none tabular-nums">~{queueInfo.estimatedWaitTime}M</p>
                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-2 leading-none">Neural Prediction Core</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6 group/sub">
                                    <p className="text-[10px] font-black text-primary-light uppercase tracking-[0.5em] leading-none opacity-80">Registry Buffer</p>
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-[1.75rem] bg-white/10 border border-white/10 flex items-center justify-center text-white shadow-2xl group-hover/sub:rotate-12 transition-transform duration-700"><Users size={28} /></div>
                                        <div>
                                            <p className="text-4xl font-black text-white tracking-tighter uppercase leading-none tabular-nums">{queueInfo.patientsAhead ?? 0} PAX</p>
                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mt-2 leading-none">Queue Separation Depth</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={64} /></div>
                        <div className="flex items-center justify-between mb-12 relative z-10">
                            <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter flex items-center gap-6 ">
                                <span className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/20"><Users size={24} /></span>
                                Clinical Sequence List
                            </h3>
                            <span className="text-[10px] font-black text-slate-500 bg-white/5 border border-white/5 px-6 py-3 rounded-full uppercase tracking-[0.3em] shadow-inner">
                                {queueData.length} ACTIVE NODES
                            </span>
                        </div>
                        <div className="space-y-4 custom-scrollbar max-h-[700px] overflow-y-auto pr-4 relative z-10">
                            {queueData.length > 0 ? queueData.map(item => <QueueItem key={item.queue_id || item.number || Math.random()} {...item} />) : (
                                <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] text-center py-20 opacity-40">Queue Buffer Empty</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-12">
                    {smartArrival && <SmartArrivalCard arrivalData={smartArrival} />}
                    
                    <div className="glass-card p-12 border-none bg-amber-500/5 relative overflow-hidden group rounded-[3.5rem] hover:border-amber-500/30 transition-all duration-700 shadow-2xl shadow-amber-500/5">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                        <div className="flex items-start gap-6 relative z-10">
                            <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20 text-amber-500 shadow-inner group-hover:rotate-6 transition-transform">
                                <ShieldCheck size={32} strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xl font-black text-amber-600 uppercase tracking-tighter leading-none mb-8 ">Registry Protocol</h4>
                                <ul className="space-y-6">
                                    {[
                                        'Arrive 15M before optimal sync.',
                                        'Valid ID biometric required.',
                                        'Automatic queue recalibration active.'
                                    ].map((text, i) => (
                                        <li key={i} className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] flex items-center gap-4 leading-relaxed">
                                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0 animate-pulse"></div> {text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-12 rounded-[3.5rem] border-none hover:border-primary/20 transition-all duration-700 text-center space-y-6 group shadow-2xl">
                        <div className="w-20 h-20 bg-primary/5 rounded-[2.5rem] flex items-center justify-center text-primary mx-auto shadow-inner group-hover:rotate-12 transition-transform">
                            <MapPin size={36} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-2">
                            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] opacity-60">Node Localization</h5>
                            <p className="text-lg font-black text-[var(--text-base)] uppercase tracking-tighter ">Alpha Wing • Level 4 • Core Sync</p>
                        </div>
                        <button className="w-full py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] hover:bg-primary hover:text-white hover:border-primary transition-all duration-700 shadow-inner ">
                            Directions Cluster
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveQueue;
