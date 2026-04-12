/**
 * Issue #44: Late Arrival Help Page - PREMIUM OVERHAUL
 * High-fidelity delay re-calibration terminal with real-time protocol overrides.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';
import { 
    Clock, AlertTriangle, CheckCircle2, Timer, Calendar,
    RefreshCw, ArrowRight, Hourglass, ChevronRight, Shield,
    XCircle, Zap, AlarmClock, Activity, ShieldCheck, Compass,
    Sparkles, Info
} from 'lucide-react';

const LateArrival = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [result, setResult] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    const appointmentId = searchParams.get('appointment');

    useEffect(() => {
        if (appointmentId) {
            checkLateStatus(appointmentId);
        } else {
            fetchTodayAppointments();
        }
    }, [appointmentId]);

    const fetchTodayAppointments = async () => {
        try {
            const res = await API.get('/appointments/my');
            const today = new Date().toISOString().split('T')[0];
            const todayApts = res.data.filter(apt => 
                apt.appointment_date.split('T')[0] === today &&
                ['scheduled', 'confirmed'].includes(apt.status)
            );
            setAppointments(todayApts);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const checkLateStatus = async (aptId) => {
        setLoading(true);
        try {
            const res = await API.get(`/late-arrival/check/${aptId}`);
            setStatus(res.data);
            setSelectedAppointment(aptId);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleOptionSelect = async (optionId) => {
        setSelectedOption(optionId);
        setProcessing(true);
        try {
            const res = await API.post('/late-arrival/process', {
                appointmentId: selectedAppointment,
                optionId
            });
            setResult(res.data);
        } catch (err) { console.error(err); } finally { setProcessing(false); }
    };

    const formatTo12Hour = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        return `${h % 12 || 12}:${minutes} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    const getStatusColor = () => {
        if (!status) return 'primary';
        if (status.isWithinGrace) return 'emerald';
        if (status.canStillBeAccommodated) return 'amber';
        if (!status.shouldAutoReschedule) return 'orange';
        return 'rose';
    };

    const getOptionIcon = (optionId) => {
        switch (optionId) {
            case 'proceed': return <CheckCircle2 size={24} />;
            case 'fit_in': return <Timer size={24} />;
            case 'end_of_session': return <Hourglass size={24} />;
            case 'reschedule': return <RefreshCw size={24} />;
            default: return <Clock size={24} />;
        }
    };

    if (loading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse italic">Synchronizing Arrival Telemetry...</div>;

    // Selection View
    if (!selectedAppointment) {
        return (
            <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700 px-4">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-[2rem] flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-inner">
                        <AlarmClock size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none mb-3">Delay Resolver</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Clinical synchronization assist for time-sensitive nodes</p>
                    </div>
                </div>

                {appointments.length > 0 ? (
                    <div className="space-y-6">
                        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] italic px-2">Pending Meridian Cycles</h2>
                        {appointments.map(apt => (
                            <button
                                key={apt.id}
                                onClick={() => checkLateStatus(apt.id)}
                                className="w-full glass-card rounded-[3rem] p-8 border border-white/5 hover:border-amber-500/20 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-700 text-left group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={48} /></div>
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner group-hover:scale-110 transition-transform">
                                            <Clock size={24} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-[var(--text-base)] uppercase italic tracking-tighter">
                                                Dr. {apt.doctor_first_name} {apt.doctor_last_name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{formatTo12Hour(apt.appointment_time)}</span>
                                                <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">{apt.appointment_type || 'Clinical Sync'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-700 group-hover:text-amber-500 group-hover:translate-x-2 transition-all" size={24} />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-24 text-center glass-modal rounded-[3.5rem] border-none shadow-2xl space-y-8">
                        <Calendar size={64} className="text-slate-700/20 mx-auto" />
                        <h3 className="text-xl font-black text-slate-500 uppercase italic tracking-tighter">Registry Silent</h3>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">No active cycles detected for the current meridian window.</p>
                        <button onClick={() => navigate('/book')} className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-[1.75rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all italic flex items-center gap-4 mx-auto">
                            Book New Appointment <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (result) {
        const isSuccess = result.success;
        return (
            <div className="max-w-2xl mx-auto pt-10 pb-20 animate-in zoom-in-95 duration-700 px-4">
                <div className="glass-modal rounded-[3.5rem] p-12 text-center border-none shadow-2xl relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-80 h-80 bg-${isSuccess ? 'emerald' : 'rose'}-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2`}></div>
                    <div className={`w-24 h-24 mx-auto mb-10 rounded-[2.5rem] flex items-center justify-center shadow-2xl border ${isSuccess ? 'bg-emerald-500 text-white border-emerald-400/20 shadow-emerald-500/30' : 'bg-rose-500 text-white border-rose-400/20 shadow-rose-500/30'} animate-bounce`}>
                        {isSuccess ? <CheckCircle2 size={48} strokeWidth={2.5} /> : <XCircle size={48} strokeWidth={2.5} />}
                    </div>
                    <h2 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic mb-4">{isSuccess ? 'Recalibration Complete' : 'Protocol Failure'}</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-12 italic leading-relaxed max-w-md mx-auto">{result.message}</p>

                    {result.handling === 'fit_in' && (
                        <div className="grid grid-cols-2 gap-6 mb-12 max-w-lg mx-auto">
                            <div className="glass-card p-8 bg-white/5 border-white/5 rounded-[2.5rem] shadow-inner">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3 italic">Registry Pos.</p>
                                <p className="text-4xl font-black text-primary italic tracking-tighter tabular-nums">#{result.queuePosition}</p>
                            </div>
                            <div className="glass-card p-8 bg-white/5 border-white/5 rounded-[2.5rem] shadow-inner">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3 italic">Est. Latency</p>
                                <p className="text-4xl font-black text-amber-500 italic tracking-tighter tabular-nums">{result.estimatedWaitMins}M</p>
                            </div>
                        </div>
                    )}

                    {result.handling === 'end_of_session' && (
                        <div className="glass-card p-10 bg-white/5 border-white/5 rounded-[3rem] mb-12 max-w-lg mx-auto relative group overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-5"><Clock size={48} /></div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 italic">Calibrated Cycle Time</p>
                            <p className="text-5xl font-black text-orange-500 italic tracking-tighter uppercase">{formatTo12Hour(result.estimatedTime)}</p>
                            <p className="text-[9px] font-black text-slate-600 mt-6 uppercase tracking-widest italic">{result.note}</p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-5 max-w-lg mx-auto relative z-10">
                        <button onClick={() => navigate('/patient-dashboard')} className="flex-1 py-5 bg-white/5 border border-white/5 text-slate-400 font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-white/10 transition-all italic">Registry Home</button>
                        {(result.handling === 'fit_in' || result.handling === 'end_of_session') && (
                            <button onClick={() => navigate('/live-queue')} className="flex-1 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all italic flex items-center justify-center gap-3">
                                Live Stream <ArrowRight size={16} />
                            </button>
                        )}
                        {result.handling === 'reschedule' && (
                            <button onClick={() => navigate('/book')} className="flex-1 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all italic">Book New Node</button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const statusColor = getStatusColor();
    const colorTheme = {
        emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: 'bg-emerald-500', text: 'text-emerald-500', pulse: 'shadow-emerald-500/20' },
        amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', icon: 'bg-amber-500', text: 'text-amber-500', pulse: 'shadow-amber-500/20' },
        orange: { bg: 'bg-orange-500/5', border: 'border-orange-200/20', icon: 'bg-orange-500', text: 'text-orange-500', pulse: 'shadow-orange-500/20' },
        rose: { bg: 'bg-rose-500/5', border: 'border-rose-500/20', icon: 'bg-rose-500', text: 'text-rose-500', pulse: 'shadow-rose-500/20' },
        primary: { bg: 'bg-primary/5', border: 'border-primary/20', icon: 'bg-primary', text: 'text-primary', pulse: 'shadow-primary/20' }
    }[statusColor];

    return (
        <div className="max-w-3xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700 px-4">
            {/* Status Radar */}
            <div className={`glass-modal rounded-[3.5rem] p-12 border-none shadow-2xl relative overflow-hidden group ${colorTheme.bg}`}>
                <div className={`absolute top-0 right-0 w-80 h-80 ${colorTheme.text} opacity-5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2`}></div>
                <div className="flex flex-col md:flex-row items-start gap-10 relative z-10">
                    <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center text-white shadow-2xl ${colorTheme.icon} ${colorTheme.pulse} flex-shrink-0 animate-pulse`}>
                        {status?.isWithinGrace ? <ShieldCheck size={40} strokeWidth={2.5} /> : <AlertTriangle size={40} strokeWidth={2.5} />}
                    </div>
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-4 mb-4">
                            <h1 className="text-3xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none">
                                {status?.isWithinGrace ? 'Grace Sync Active' : 
                                 status?.canStillBeAccommodated ? 'Latency Detected' :
                                 status?.shouldAutoReschedule ? 'Critical Protocol Breach' : 'System Stall'}
                            </h1>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest italic border ${colorTheme.border} ${colorTheme.text} bg-white/5`}>
                                {status?.minutesLate > 0 ? `${status.minutesLate}M Threshold` : 'Baseline Delta'}
                            </span>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic leading-relaxed">
                            {status?.isWithinGrace ? 'Registry allows standard entry within current parameters.' :
                             status?.canStillBeAccommodated ? 'Clinical buffer available. Recalibrate arrival index below.' :
                             status?.shouldAutoReschedule ? 'Buffer exhausted. Mandatory node rescheduling recommended.' : 
                             'Identify recovery path in the available protocols.'}
                        </p>
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
                    <MetricNode label="Scheduled Index" value={status?.appointmentTime ? new Date(status.appointmentTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '--'} />
                    <MetricNode label="Current Baseline" value={new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} />
                    <MetricNode label="Grace Buffer" value={`${status?.policy?.gracePeriodMins || 10}M`} />
                </div>
            </div>

            {/* Protocol Override Selection */}
            <div className="glass-modal rounded-[3.5rem] p-12 border-none shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={48} /></div>
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-10 italic px-2 flex items-center gap-3">
                    <Sparkles size={16} className="text-primary" /> Available Overrides
                </h2>

                <div className="space-y-6">
                    {status?.options?.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleOptionSelect(option.id)}
                            disabled={processing}
                            className={`w-full p-8 rounded-[2.5rem] border transition-all duration-700 text-left group relative overflow-hidden shadow-inner ${
                                selectedOption === option.id 
                                    ? 'border-primary bg-primary/5'
                                    : option.recommended 
                                        ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
                                        : 'border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10'
                            } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {option.recommended && (
                                <div className="absolute top-0 right-0 px-6 py-2 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-[0.4em] italic rounded-bl-[1.5rem] shadow-2xl">
                                    Recommended
                                </div>
                            )}

                            <div className="flex items-center gap-8 relative z-10">
                                <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-white flex-shrink-0 shadow-2xl ${
                                    option.id === 'proceed' ? 'bg-emerald-500 border-emerald-400/20' : 
                                    option.id === 'fit_in' ? 'bg-primary border-primary/20' : 
                                    option.id === 'end_of_session' ? 'bg-orange-500 border-orange-400/20' : 
                                    'bg-slate-700 border-slate-600/20'
                                }`}>
                                    {getOptionIcon(option.id)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-black text-[var(--text-base)] uppercase italic tracking-tighter mb-1">{option.label}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic opacity-60">{option.description}</p>
                                    {option.estimatedWaitMins && (
                                        <p className="text-[10px] font-black text-amber-500 mt-3 uppercase tracking-widest italic flex items-center gap-2">
                                            <Timer size={14} className="animate-pulse" /> ~{option.estimatedWaitMins}M Potential Latency
                                        </p>
                                    )}
                                </div>
                                <ArrowRight className={`group-hover:translate-x-3 transition-transform duration-700 ${option.recommended ? 'text-emerald-500 shadow-emerald-500/20' : 'text-slate-700'}`} size={24} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Registry Policy Cluster */}
            <div className="glass-card rounded-[3rem] p-10 border-white/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Shield size={48} /></div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-10 italic px-2">Clinical Policy Manual</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <PolicyModule label="Grace Sync" value={`${status?.policy?.gracePeriodMins || 10}M`} />
                    <PolicyModule label="Max Tolerance" value={`${status?.policy?.maxLateMins || 30}M`} />
                    <PolicyModule label="Fit-In Allowed" value={status?.policy?.allowFitIn ? 'YES' : 'NO'} />
                    <PolicyModule label="Fault Cutoff" value={`${status?.policy?.autoRescheduleAfterMins || 45}M`} />
                </div>
            </div>
        </div>
    );
};

const MetricNode = ({ label, value }) => (
    <div className="bg-white/5 border border-white/5 rounded-[1.75rem] p-6 text-center shadow-inner group-hover:bg-white/10 transition-all">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] mb-3 italic">{label}</p>
        <p className="text-xl font-black text-[var(--text-base)] uppercase italic tracking-tighter">{value}</p>
    </div>
);

const PolicyModule = ({ label, value }) => (
    <div className="space-y-2">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic opacity-60 leading-none">{label}</p>
        <p className="text-lg font-black text-slate-400 uppercase italic leading-none">{value}</p>
    </div>
);

export default LateArrival;
