/**
 * Issue #42: Virtual Waiting Room - PREMIUM OVERHAUL
 * Neural Latency Tracker for real-time remote clinical synchronization.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Home, Clock, MapPin, CheckCircle2, AlertCircle, RefreshCw, 
    Navigation2, Car, Building2, Wifi, WifiOff, Bell, X, 
    Users, Timer, Sparkles, ArrowRight, Phone, Activity,
    Zap, ShieldCheck, Compass, Info, Target, Heart, Radio,
    Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { sseService } from '../services/sseService';

const PING_INTERVAL = 30_000;
const FALLBACK_POLL = 60_000;

const StatusBadge = ({ status }) => {
    const statusConfig = {
        NOT_CHECKED_IN: { label: 'Idle Node', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: Target },
        CHECKED_IN: { label: 'In Registry', color: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle2 },
        EN_ROUTE: { label: 'On Path', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Car },
        ARRIVED: { label: 'Unit Arrived', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Building2 }
    };
    
    const config = statusConfig[status] || statusConfig.NOT_CHECKED_IN;
    const Icon = config.icon;
    
    return (
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${config.color} shadow-inner`}>
            <Icon size={14} strokeWidth={2.5} />
            {config.label}
        </span>
    );
};

const ConnectionStatus = ({ isConnected }) => (
    <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full border transition-all duration-700 ${
        isConnected ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/5 text-rose-500 border-rose-500/20 animate-pulse'
    }`}>
        {isConnected ? <Radio size={14} className="animate-pulse" /> : <WifiOff size={14} />}
        {isConnected ? 'Neural Sync Active' : 'Resyncing Cluster...'}
    </div>
);

const ETAModal = ({ isOpen, onClose, onSubmit, title }) => {
    const [eta, setEta] = useState(15);
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="glass-modal rounded-[3rem] p-10 w-full max-w-sm border-none shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tighter">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-2xl transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>
                <div className="mb-10">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block ">
                        Latency Calibration (Minutes)
                    </label>
                    <div className="space-y-6">
                        <div className="flex items-center gap-6">
                            <input
                                type="range"
                                min="5"
                                max="60"
                                value={eta}
                                onChange={(e) => setEta(parseInt(e.target.value))}
                                className="flex-1 h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <span className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center font-black text-primary text-2xl tabular-nums shadow-inner">
                                {eta}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={onClose} className="py-4 px-6 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] hover:bg-white/10 transition-all">Abort</button>
                    <button onClick={() => onSubmit(eta)} className="py-4 px-6 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all">Execute</button>
                </div>
            </div>
        </div>
    );
};

const VirtualWaitingRoom = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [status, setStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(true);
    const [showETAModal, setShowETAModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        if (!appointmentId || !user?.id) return;
        try {
            const data = await apiClient.get(`/api/virtual-checkin/${appointmentId}/status`, null);
            if (!data) throw new Error('Sync Failure');
            setStatus(data);
            setIsConnected(true);
            setError(null);
        } catch (err) { 
            setIsConnected(false); 
            setError('Neural Link Severed'); 
        } finally { 
            setIsLoading(false); 
        }
    }, [appointmentId, user?.id]);

    const pingSession = useCallback(async () => {
        if (!appointmentId || !status?.isCheckedIn) return;
        try {
            await apiClient.post(`/api/virtual-checkin/${appointmentId}/ping`, {});
            setIsConnected(true);
        } catch (err) { 
            setIsConnected(false); 
        }
    }, [appointmentId, status?.isCheckedIn]);

    useEffect(() => {
        fetchStatus();
        const statusInterval = setInterval(fetchStatus, FALLBACK_POLL);
        return () => clearInterval(statusInterval);
    }, [fetchStatus]);

    useEffect(() => {
        if (!appointmentId || !user?.id) return;
        
        sseService.connect(
            appointmentId,
            (data) => setStatus(data),
            () => setIsConnected(false)
        );
        
        return () => sseService.disconnect();
    }, [appointmentId, user?.id]);

    useEffect(() => {
        if (!status?.isCheckedIn) return;
        const pingInterval = setInterval(pingSession, PING_INTERVAL);
        return () => clearInterval(pingInterval);
    }, [pingSession, status?.isCheckedIn]);

    const handleCheckin = async (etaMinutes) => {
        setActionLoading(true);
        try {
            const res = await apiClient.post(`/api/virtual-checkin/${appointmentId}/checkin`, { etaMinutes, device: 'web' });
            if (res.error) throw new Error(res.error || 'Protocol Failure');
            await fetchStatus();
            setShowETAModal(false);
        } catch (err) { 
            alert(err.message); 
        } finally { 
            setActionLoading(false); 
        }
    };

    const handleStatusUpdate = async (newStatus, etaMinutes = null) => {
        setActionLoading(true);
        try {
            const res = await apiClient.post(`/api/virtual-checkin/${appointmentId}/status`, { status: newStatus, etaMinutes });
            if (res.error) throw new Error('Status Refusal');
            await fetchStatus();
            setShowETAModal(false);
            setPendingAction(null);
        } catch (err) { 
            alert(err.message); 
        } finally { 
            setActionLoading(false); 
        }
    };

    const handleCancel = async () => {
        if (!confirm('Abort virtual check-in protocol?')) return;
        setActionLoading(true);
        try {
            await apiClient.delete(`/api/virtual-checkin/${appointmentId}/checkin`);
            await fetchStatus();
        } catch (err) { 
            alert('Abort Failure'); 
        } finally { 
            setActionLoading(false); 
        }
    };

    const handleETASubmit = (eta) => {
        if (pendingAction === 'checkin') handleCheckin(eta);
        else if (pendingAction === 'enroute') handleStatusUpdate('EN_ROUTE', eta);
        else if (pendingAction === 'late') handleStatusUpdate('RUNNING_LATE', eta);
    };

    if (isLoading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse ">Synchronizing Waiting Module...</div>;

    if (!status?.appointment) {
        return (
            <div className="max-w-lg mx-auto py-24 text-center glass-modal rounded-[3.5rem] border-none shadow-2xl space-y-8">
                <AlertCircle size={64} className="text-slate-700/20 mx-auto" />
                <h3 className="text-xl font-black text-slate-500 uppercase tracking-tighter">Node Not Found</h3>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ">Active clinical appointment node not detected.</p>
                <button onClick={() => navigate('/dashboard')} className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-[1.75rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all mx-auto">
                    Registry Dashboard
                </button>
            </div>
        );
    }

    const { appointment, queue, isCheckedIn } = status;
    const currentStatus = appointment.virtualCheckinStatus;

    return (
        <div className="max-w-2xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700 px-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left">
                    <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none mb-3 flex items-center justify-center sm:justify-start gap-4">
                        Waiting Room
                        <div className="flex h-3 w-3 relative">
                            <div className={`animate-ping absolute h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`}></div>
                            <div className={`relative h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        </div>
                    </h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">Real-time remote clinical throughput monitor</p>
                </div>
                <ConnectionStatus isConnected={isConnected} />
            </div>

            <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Building2 size={48} /></div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-primary text-white rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-primary/30 border border-primary-light/20 rotate-3 transition-transform group-hover:rotate-0 duration-700">
                            <Activity size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter">Dr. {appointment.doctor}</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ">{appointment.specialty}</p>
                        </div>
                    </div>
                    <StatusBadge status={currentStatus} />
                </div>
                
                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5 relative z-10">
                    <div className="flex items-center gap-4 text-[10px] font-black text-primary uppercase tracking-[0.3em] ">
                        <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center"><Clock size={16} /></div>
                        {appointment.time} MST
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center"><Calendar size={16} /></div>
                        {new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                </div>
            </div>

            {isCheckedIn && (
                <div className="glass-modal rounded-[3.5rem] p-10 bg-gradient-to-br from-primary to-primary-hover border-none shadow-2xl relative overflow-hidden transition-all duration-700 hover:shadow-primary/20">
                     <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 -z-10"></div>
                    <div className="flex items-center gap-4 mb-10 relative z-10">
                        <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-white shadow-inner"><Users size={20} /></div>
                        <h4 className="text-[11px] font-black text-white/90 uppercase tracking-[0.5em] ">Queue Status Telemetry</h4>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6 relative z-10">
                        <MetricNode label="Index Pos." value={queue?.position || '-'} light />
                        <MetricNode label="Est. Wait" value={`${queue?.estimatedWaitMins || 0}M`} light />
                        <MetricNode label="Call Time" value={queue?.estimatedCallTime ? new Date(queue.estimatedCallTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '--'} light />
                    </div>

                    {appointment.checkinTime && (
                        <p className="text-[8px] font-black text-white/40 mt-10 text-center uppercase tracking-[0.3em] ">
                            NODE INITIALIZED AT {new Date(appointment.checkinTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                    )}
                </div>
            )}

            <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={48} /></div>
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-10 px-2 flex items-center gap-3">
                    <Sparkles className="text-primary" size={16} /> Protocol Overrides
                </h4>
                
                {currentStatus === 'NOT_CHECKED_IN' && (
                    <div className="space-y-6">
                        <button
                            onClick={() => { setPendingAction('checkin'); setShowETAModal(true); }}
                            disabled={actionLoading}
                            className="w-full py-6 bg-primary text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 hover:shadow-2xl hover:shadow-primary/40 transition-all "
                        >
                            <Home size={20} /> Initialize Remote Check-in <ArrowRight size={20} />
                        </button>
                        <p className="text-[9px] font-bold text-slate-500 text-center uppercase tracking-widest opacity-60">Notify registry of virtual presence for priority queuing.</p>
                    </div>
                )}

                {currentStatus === 'CHECKED_IN' && (
                    <div className="space-y-4">
                        <button onClick={() => { setPendingAction('enroute'); setShowETAModal(true); }} disabled={actionLoading} className="w-full py-5 bg-amber-500 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:shadow-2xl hover:shadow-amber-500/30 transition-all ">
                            <Car size={20} /> Synchronize Transit
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => { setPendingAction('late'); setShowETAModal(true); }} disabled={actionLoading} className="py-4 border border-orange-500/20 bg-orange-500/5 text-orange-500 rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:bg-orange-500/10 transition-all ">
                                <Timer size={18} /> Resync ETA
                            </button>
                            <button onClick={handleCancel} disabled={actionLoading} className="py-4 border border-white/5 bg-white/5 text-slate-500 rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all ">
                                <X size={18} /> Abort
                            </button>
                        </div>
                    </div>
                )}

                {currentStatus === 'EN_ROUTE' && (
                    <div className="space-y-4">
                        <button onClick={() => handleStatusUpdate('ARRIVED')} disabled={actionLoading} className="w-full py-6 bg-emerald-500 text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 hover:shadow-2xl hover:shadow-emerald-500/40 transition-all ">
                            <Building2 size={24} /> Confirm Clinical Arrival
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => { setPendingAction('late'); setShowETAModal(true); }} disabled={actionLoading} className="py-4 border border-amber-500/20 bg-amber-500/5 text-amber-500 rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:bg-amber-500/10 transition-all ">
                                <Timer size={18} /> Update Delta
                            </button>
                            <button onClick={handleCancel} disabled={actionLoading} className="py-4 border border-white/5 bg-white/5 text-slate-500 rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all ">
                                <X size={18} /> Abort
                            </button>
                        </div>
                    </div>
                )}

                {currentStatus === 'ARRIVED' && (
                    <div className="text-center py-10 bg-emerald-500/5 rounded-[3rem] border border-emerald-500/10 scale-95 opacity-90">
                        <div className="w-20 h-20 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/30 border border-emerald-400/20">
                            <CheckCircle2 size={40} strokeWidth={2.5} />
                        </div>
                        <h4 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter mb-4">Registry Success</h4>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-xs mx-auto">Arrival confirmed. Please proceed to the clinical terminal.</p>
                    </div>
                )}
            </div>

            <div className="glass-card rounded-[3rem] p-10 border-none bg-amber-500/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Bell size={48} /></div>
                <div className="flex items-start gap-8 relative z-10">
                    <div className="w-16 h-16 bg-white shadow-2xl shadow-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 flex-shrink-0">
                        <Info size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-amber-600 uppercase tracking-tighter mb-4">Visit Protocols</h4>
                        <ul className="space-y-4">
                            {['Maintain neural sync app focus.', 'Buffer notifications enabled.', 'ID Biometrics verified.'].map((text, i) => (
                                <li key={i} className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div> {text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <button onClick={() => navigate('/live-queue')} className="py-5 bg-white/5 border border-white/5 text-slate-400 font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                    <Users size={18} /> Full Stream
                </button>
                <button onClick={() => navigate('/dashboard')} className="py-5 bg-white/5 border border-white/5 text-slate-400 font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-white/10 transition-all flex items-center justify-center gap-3">
                    <Home size={18} /> Dashboard
                </button>
            </div>

            <ETAModal
                isOpen={showETAModal}
                onClose={() => { setShowETAModal(false); setPendingAction(null); }}
                onSubmit={handleETASubmit}
                title={pendingAction === 'checkin' ? 'Initialize Sync' : 'Recalibrate ETA'}
            />
        </div>
    );
};

const MetricNode = ({ label, value, light }) => (
    <div className={`p-6 rounded-[2rem] text-center shadow-inner transition-all flex flex-col items-center justify-center border ${
        light ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/5 group-hover:bg-white/10'
    }`}>
        <p className={`text-[8px] font-black uppercase tracking-[0.4em] mb-2 ${light ? 'text-white/60' : 'text-slate-600'}`}>{label}</p>
        <p className={`text-2xl font-black tracking-tighter tabular-nums ${light ? 'text-white' : 'text-[var(--text-base)]'}`}>{value}</p>
    </div>
);

export default VirtualWaitingRoom;
