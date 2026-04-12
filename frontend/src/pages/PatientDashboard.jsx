/**
 * Issue #40: Patient Dashboard - PREMIUM HARDENING
 * Control Center for patient clinical overview with robust fault-tolerance.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, User, 
    ChevronRight, Bell, X, ListPlus, Home, Wifi, FileText, Pill, 
    Activity, Zap, ClipboardCheck, AlarmClock, MessageSquare, 
    ArrowRight, Sparkles, Navigation, Lock, Users 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';
import { safeFetch } from '../utils/apiHelper';

const STATUS_STYLES = {
    CONFIRMED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    PENDING:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
    COMPLETED: 'bg-primary/10 text-primary border-primary/20',
    CANCELLED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    LATE_ARRIVAL: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    NEEDS_RESCHEDULE: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
};

const COLOR_MAP = {
    rose: {
        bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20',
        hoverBg: 'hover:bg-rose-500/5', hoverBorder: 'hover:border-rose-500/20', shadow: 'hover:shadow-rose-500/10',
        iconBg: 'bg-rose-500/10', iconText: 'text-rose-500', iconBorder: 'border-rose-500/10'
    },
    amber: {
        bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20',
        hoverBg: 'hover:bg-amber-500/5', hoverBorder: 'hover:border-amber-500/20', shadow: 'hover:shadow-amber-500/10',
        iconBg: 'bg-amber-500/10', iconText: 'text-amber-500', iconBorder: 'border-amber-500/10'
    },
    emerald: {
        bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20',
        hoverBg: 'hover:bg-emerald-500/5', hoverBorder: 'hover:border-emerald-500/20', shadow: 'hover:shadow-emerald-500/10',
        iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-500', iconBorder: 'border-emerald-500/10'
    },
    primary: {
        bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20',
        hoverBg: 'hover:bg-primary/5', hoverBorder: 'hover:border-primary/20', shadow: 'hover:shadow-primary/10',
        iconBg: 'bg-primary/10', iconText: 'text-primary', iconBorder: 'border-primary/10'
    }
};

const PulseIcon = ({ size }) => (
    <div className="relative flex items-center justify-center">
        <Activity size={size} />
        <span className="absolute animate-ping h-full w-full rounded-full bg-primary/20 opacity-75"></span>
    </div>
);

const StatCard = ({ title, value, icon: Icon, sub, onClick }) => (
    <div 
        onClick={onClick}
        className={`glass-card p-6 rounded-[2.5rem] flex flex-col justify-between group transition-all duration-700 ${onClick ? 'cursor-pointer hover:shadow-primary/5 hover:-translate-y-1 active:scale-[0.98]' : ''} border-[var(--border-base)] relative overflow-hidden h-full min-h-[160px]`}
    >
        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="flex justify-between items-start relative z-10 w-full mb-4">
            <div className="flex-1 min-w-0 pr-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 italic truncate">{title}</p>
                <h3 className="text-3xl font-black text-[var(--test-base)] tracking-tighter uppercase italic truncate">{String(value ?? '—')}</h3>
            </div>
            {Icon && (
                <div className="p-3 bg-white/5 text-slate-400 rounded-2xl border border-white/5 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner flex-shrink-0">
                    {typeof Icon === 'function' ? <Icon size={20} /> : <Icon size={20} />}
                </div>
            )}
        </div>
        {sub && <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-60 flex items-center gap-1.5 truncate mt-auto"><Sparkles size={10} /> {sub}</p>}
    </div>
);

const AppointmentCard = ({ apt, navigate, onViewReport }) => {
    if (!apt) return null;
    const doctor = `Dr. ${apt.doc_first || 'Unknown'} ${apt.doc_last || ''}`;
    const statusLabel = String(apt.status || 'PENDING').toUpperCase();
    const dateStr = apt.appointment_date ? new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD';
    
    const today = new Date().toISOString().split('T')[0];
    const aptDate = apt.appointment_date ? new Date(apt.appointment_date).toISOString().split('T')[0] : '';
    const isToday = today === aptDate;
    const canVirtualCheckin = isToday && ['CONFIRMED', 'PENDING', 'WAITING', 'IN_PROGRESS', 'LATE_ARRIVAL'].includes(statusLabel);

    return (
        <div className="glass-card p-6 rounded-[2.5rem] border-[var(--border-base)] hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-700 group relative overflow-hidden">
             {isToday && <div className="absolute top-0 right-0 px-4 py-1 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-bl-2xl">Today's Cycle</div>}
            <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[1.75rem] overflow-hidden border-2 border-white/5 p-1 bg-white/5">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(doctor)}&background=4338ca&color=fff&size=200`} alt={doctor} className="w-full h-full object-cover rounded-[1.5rem] opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-black text-[var(--test-base)] text-base tracking-tight italic uppercase truncate">{doctor}</h4>
                        <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1 truncate">{apt.specialty || 'General'}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest border flex-shrink-0 ${STATUS_STYLES[statusLabel] || 'bg-white/5 text-slate-500 border-white/10'}`}>
                    {statusLabel.replace('_', ' ')}
                </span>
            </div>
            <div className="flex items-center gap-6 py-6 border-y border-white/5 relative z-10 mb-6">
                <div className="flex items-center gap-3 text-slate-500">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-primary border border-white/5"><CalendarIcon size={14} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{dateStr}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-primary border border-white/5"><Clock size={14} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">{apt.time_slot || '--:--'}</span>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {canVirtualCheckin && (
                    <button onClick={() => navigate(`/virtual-waiting/${apt.id}`)} className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 hover:bg-primary-hover shadow-xl shadow-primary/20 transition-all active:scale-95 group/btn">
                        <Wifi size={14} className="animate-pulse" /> Virtual Check-in <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                )}
                {statusLabel === 'COMPLETED' && (apt.diagnosis || apt.prescription || apt.notes) && (
                    <button onClick={() => onViewReport(apt)} className="w-full py-4 bg-white/5 border border-[var(--border-base)] text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 hover:text-[var(--text-base)] transition-all">
                        <FileText size={14} /> Access Clinical Dossier
                    </button>
                )}
            </div>
        </div>
    );
};

const SmartActionCard = ({ icon: Icon, title, desc, color, onClick, cta }) => {
    const theme = COLOR_MAP[color] || COLOR_MAP.primary;
    return (
        <div onClick={onClick} className={`bg-white/5 rounded-[2.5rem] border-[var(--border-base)] p-8 ${theme.hoverBg} ${theme.hoverBorder} ${theme.shadow} transition-all duration-700 group cursor-pointer relative overflow-hidden h-full flex flex-col`}>
            <div className={`absolute top-0 left-0 w-24 h-24 ${theme.bg} rounded-full blur-3xl -translate-y-12 -translate-x-12`}></div>
            <div className={`p-4 ${theme.iconBg} ${theme.iconText} rounded-2xl w-fit mb-6 border ${theme.iconBorder} transition-transform duration-700 group-hover:scale-110 shadow-inner`}><Icon size={24} strokeWidth={2.5} /></div>
            <h3 className={`text-lg font-black ${theme.text} mb-2 uppercase tracking-tight italic`}>{title}</h3>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest mb-6 opacity-70 group-hover:opacity-100 transition-opacity flex-1">{desc}</p>
            <span className={`text-[9px] font-black ${theme.text} flex items-center gap-2 uppercase tracking-[0.3em] group-hover:translate-x-2 transition-transform italic mt-auto`}>{cta} <ArrowRight size={14} /></span>
        </div>
    );
};

const PatientDashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ upcoming: [], past: [], waitlist: [], offers: [], feedback: [], express: [], prep: [], vitals: [], prescriptions: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [selectedReportApt, setSelectedReportApt] = useState(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.id) {
            const timer = setTimeout(() => setIsLoading(false), 2000);
            return () => clearTimeout(timer);
        }
        
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const headers = authedHeaders();
                const endpoints = [
                    { key: 'upcoming', url: `${API}/api/patients/${user.id}/appointments?type=upcoming` },
                    { key: 'past', url: `${API}/api/patients/${user.id}/appointments?type=past` },
                    { key: 'waitlist', url: `${API}/api/appointments/waitlist/my` },
                    { key: 'offers', url: `${API}/api/appointments/waitlist/offers` },
                    { key: 'feedback', url: `${API}/api/feedback/pending` },
                    { key: 'express', url: `${API}/api/express-checkin/today` },
                    { key: 'prep', url: `${API}/api/prep/overview` },
                    { key: 'vitals', url: `${API}/api/patients/${user.id}/vitals` },
                    { key: 'prescriptions', url: `${API}/api/patients/${user.id}/prescriptions` }
                ];

                const results = await Promise.all(endpoints.map(ep => safeFetch(ep.url, { headers })));
                
                const newStats = {};
                endpoints.forEach((ep, i) => {
                    const rawData = results[i];
                    // Strict Pruning: Ensure we only store valid object arrays
                    const parsedData = Array.isArray(rawData) ? rawData : (rawData?.data || []);
                    newStats[ep.key] = parsedData.filter(item => item !== null && typeof item === 'object');
                });

                setStats(prev => ({ ...prev, ...newStats }));
            } catch (err) { 
                console.error('[Dashboard] Registry sync failed:', err); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchData();
    }, [user?.id, authLoading]);

    if (authLoading || (isLoading && user)) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-10 space-y-12 animate-in fade-in duration-700">
                <div className="relative">
                    <div className="w-32 h-32 border-[12px] border-primary/5 border-t-primary rounded-full animate-[spin_1.5s_linear_infinite]"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-primary group">
                        <Zap size={40} className="animate-pulse drop-shadow-[0_0_15px_rgba(67,56,202,0.5)]" />
                    </div>
                </div>
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-black text-[var(--test-base)] uppercase italic tracking-widest animate-pulse">Synchronizing Personal Registry</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic opacity-60">Authentication handshake in progress...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-10 text-center space-y-8 animate-in fade-in duration-1000">
                <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-[3.5rem] flex items-center justify-center border border-rose-500/20 shadow-inner group">
                    <Lock size={40} className="group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div>
                    <h2 className="text-4xl font-black text-[var(--test-base)] uppercase italic tracking-tighter">Access Denied</h2>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-4 italic opacity-80 max-w-sm mx-auto">Neural key signature not detected. Active session required for registry access.</p>
                </div>
                <button 
                    onClick={() => navigate('/login')} 
                    className="px-12 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all active:scale-95 italic group"
                >
                    <span className="flex items-center gap-3">Initialize Handshake <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></span>
                </button>
            </div>
        );
    }

    // Defensive Dervivations
    const upcoming = stats.upcoming || [];
    const past = stats.past || [];
    const vitals = stats.vitals || [];
    const prescriptions = stats.prescriptions || [];
    const feedback = stats.feedback || [];
    const express = stats.express || [];
    const prep = stats.prep || [];

    const completedCount = past.filter(a => a && a.status?.toUpperCase() === 'COMPLETED').length;
    const uniqueDoctors = new Set([...upcoming, ...past].filter(a => a && a.doc_first).map(a => `${a.doc_first} ${a.doc_last}`)).size || 0;
    const nextApt = upcoming[0];
    const latestVitals = Array.isArray(vitals) && vitals.length > 0 ? vitals[0] : null;

    const nextAptLabel = nextApt?.appointment_date ? new Date(nextApt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
    const nextAptSub = nextApt?.time_slot || 'no scheduled cycle';
    
    const displayed = activeTab === 'upcoming' ? upcoming : past;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const todayApt = upcoming.find(apt => {
        if (!apt?.appointment_date) return false;
        const d = new Date(apt.appointment_date).toISOString().split('T')[0];
        return d === todayStr && !['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(apt.status?.toUpperCase() || '');
    });

    let runningLateApt = null;
    if (todayApt?.time_slot) {
        try {
            const parts = todayApt.time_slot.split(':');
            if (parts.length >= 2) {
                let h = parseInt(parts[0]);
                let m = parseInt(parts[1]);
                const isPM = todayApt.time_slot.toUpperCase().includes('PM');
                if (isPM && h < 12) h += 12;
                if (!isPM && h === 12) h = 0;
                const aptT = new Date(); 
                aptT.setHours(h, m, 0, 0);
                const diff = (aptT - now) / 60000;
                if (diff <= 60 && diff >= -60) runningLateApt = todayApt;
            }
        } catch (e) {
            console.warn('[Dashboard] Time slot parsing deviation:', e);
        }
    }
    
    const expressCard = express[0];
    const feedbackCard = feedback[0];
    const pendingPrepApt = prep.find(p => {
        if (!p?.appointment?.appointment_date) return false;
        const diffH = (new Date(p.appointment.appointment_date) - now) / 3600000;
        return diffH >= -24 && diffH <= 48 && (p.prepProgress?.requiredCompleted || 0) < (p.prepProgress?.requiredTotal || 0);
    });
    const hasSmartActions = !!(runningLateApt || expressCard || pendingPrepApt || feedbackCard);

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header / Hero */}
            <div className="glass-modal rounded-[4rem] p-12 flex flex-col md:flex-row justify-between items-center gap-10 relative overflow-hidden border-none shadow-2xl transition-all duration-1000 hover:shadow-primary/15 group">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
                <div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-primary/15 rounded-2xl flex items-center justify-center text-primary shadow-inner rotate-6 transition-transform group-hover:rotate-12 duration-700"><Home size={24} /></div>
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] italic opacity-70">Clinical Node Activated</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black text-[var(--test-base)] tracking-tighter uppercase italic leading-[0.9]">Registry: <span className="text-primary drop-shadow-sm">{user?.first_name || 'Subject'}</span></h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-6 italic opacity-60 flex items-center gap-3">
                         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Telemetry live • Encrypted handshake success
                    </p>
                </div>
                <button onClick={() => navigate('/doctor-search')} className="py-6 px-12 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2.5rem] shadow-[0_20px_50px_rgba(67,56,202,0.3)] hover:shadow-[0_25px_60px_rgba(67,56,202,0.5)] hover:-translate-y-1.5 transition-all active:scale-95 flex items-center gap-5 group/btn italic">
                    <ListPlus size={22} className="group-hover/btn:rotate-180 transition-transform duration-700" /> New Reservation
                </button>
            </div>

            {/* Smart Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <StatCard title="Reservations" value={upcoming.length} icon={CalendarIcon} sub="Confirmed Nodes" onClick={() => setActiveTab('upcoming')} />
                <StatCard title="Clinical Visits" value={completedCount} icon={CheckCircle2} sub="Total History" />
                <StatCard title="Practitioners" value={uniqueDoctors} icon={User} sub="Verified Contacts" />
                <StatCard title="Cycle Index" value={nextAptLabel} icon={Activity} sub={nextAptSub} />
                <StatCard title="Biometry" value={latestVitals ? `${latestVitals.blood_pressure_sys || '—'}/${latestVitals.blood_pressure_dia || '—'}` : '—'} icon={() => <PulseIcon size={20} />} sub="Latest Vitals" onClick={() => navigate('/vitals')} />
                <StatCard title="Dossiers" value={prescriptions.length} icon={Pill} sub="Medical Logs" onClick={() => navigate('/prescriptions')} />
            </div>

            {/* Recommended Actions */}
            {hasSmartActions && (
                <div className="animate-in slide-in-from-bottom-12 duration-1000">
                    <div className="flex items-center gap-4 mb-10 pl-2">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner"><Zap size={24} className="animate-pulse" /></div>
                        <h2 className="text-2xl font-black text-[var(--test-base)] uppercase tracking-tight italic">Recommended Protocols</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {runningLateApt && <SmartActionCard icon={AlarmClock} title="Sync Delay" desc="Cycle deviation detected. Notify facility ops?" color="rose" onClick={() => navigate(`/late-arrival?appointment=${runningLateApt.id}`)} cta="Execute Protocol" />}
                        {expressCard && <SmartActionCard icon={Zap} title="Express Entry" desc="Registry verified. Bypassing standard intake." color="amber" onClick={() => navigate('/express-checkin')} cta="Initiate Check-in" />}
                        {pendingPrepApt && <SmartActionCard icon={ClipboardCheck} title="Pre-Op Check" desc="Pending biometric packets for upcoming cycle." color="primary" onClick={() => navigate(`/prep-checklist/${pendingPrepApt.appointment.id}`)} cta="Complete Packets" />}
                        {feedbackCard && <SmartActionCard icon={MessageSquare} title="Cycle Rating" desc="Help optimize clinical experience for node sync." color="emerald" onClick={() => navigate('/feedback')} cta="Transmit Feed" />}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                <div className="lg:col-span-2 space-y-12">
                    <div className="flex gap-12 border-b border-white/5 mb-10 overflow-x-auto no-scrollbar scroll-smooth px-2">
                        <TabButton active={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')} label={`Active Nodes (${upcoming.length})`} />
                        <TabButton active={activeTab === 'past'} onClick={() => setActiveTab('past')} label={`Registry Logs (${past.length})`} />
                    </div>
                    {displayed.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-8">
                            {displayed.map(apt => apt && <AppointmentCard key={apt.id || Math.random()} apt={apt} navigate={navigate} onViewReport={setSelectedReportApt} />)}
                        </div>
                    ) : (
                        <div className="py-32 text-center glass-card rounded-[4rem] border-none flex flex-col items-center group">
                            <CalendarIcon size={64} className="text-slate-500 opacity-10 mb-8 group-hover:scale-110 transition-transform duration-700" />
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] italic leading-relaxed opacity-60">No data packets found in this sector.</p>
                            {activeTab === 'upcoming' && <button onClick={() => navigate('/doctor-search')} className="mt-12 text-primary font-black text-[11px] uppercase tracking-[0.4em] hover:opacity-70 transition-opacity italic flex items-center gap-3">Initialize first Reservation <ChevronRight size={14} /></button>}
                        </div>
                    )}
                </div>
                <div className="space-y-16">
                    <div className="space-y-8">
                        <div className="flex items-center gap-5 px-4">
                             <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 border border-white/5 shadow-inner"><Activity size={20} /></div>
                             <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Telemetry History</h2>
                        </div>
                        <div className="glass-card rounded-[3.5rem] p-12 border-[var(--border-base)] relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-15 transition-opacity duration-1000 rotate-12"><Navigation size={64} /></div>
                            {past.length === 0 ? <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] italic text-center py-12 opacity-40">Registry Empty</p> : (
                                <div className="space-y-12 relative">
                                    <div className="absolute left-[3px] top-2 bottom-8 w-[1px] bg-white/5"></div>
                                    {past.slice(0, 5).map(apt => apt && (
                                        <div key={apt.id || Math.random()} className="relative pl-10 group/item">
                                            <div className="absolute left-0 top-[8px] w-2 h-2 rounded-full border border-white/20 bg-[var(--bg-base)] group-hover/item:border-primary group-hover/item:scale-150 transition-all duration-500 shadow-inner"></div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic opacity-50">{apt.appointment_date ? new Date(apt.appointment_date).toLocaleDateString() : 'TBD'}</p>
                                            <h4 className="text-[13px] font-black text-[var(--test-base)] uppercase tracking-tight italic transition-colors group-hover/item:text-primary leading-none truncate">Dr. {apt.doc_first} {apt.doc_last}</h4>
                                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mt-2.5 truncate opacity-70">{apt.specialty}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedReportApt && (
                <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-6 z-[100] animate-in fade-in duration-700">
                    <div className="glass-modal rounded-[4.5rem] w-full max-w-2xl overflow-hidden border-none shadow-[0_50px_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-700">
                        <div className="p-12 border-b border-white/10 flex justify-between items-center bg-white/5 relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                            <div className="min-w-0 pr-6">
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em] mb-3 italic">Clinical Dossier: Verified</p>
                                <h3 className="text-3xl font-black text-[var(--test-base)] tracking-tighter uppercase italic truncate">Registry Entry #{selectedReportApt.id}</h3>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-3 truncate">{selectedReportApt.doc_first} {selectedReportApt.doc_last} • {selectedReportApt.appointment_date}</p>
                            </div>
                            <button onClick={() => setSelectedReportApt(null)} className="p-5 text-slate-500 hover:text-rose-500 rounded-3xl bg-white/5 hover:bg-rose-500/10 transition-all flex-shrink-0"><X size={28} /></button>
                        </div>
                        <div className="p-12 space-y-12 max-h-[65vh] overflow-y-auto custom-scrollbar italic">
                            <DocSec icon={<Activity size={20} />} title="Clinical Findings" text={selectedReportApt.diagnosis} />
                            <DocSec icon={<Pill size={20} />} title="Neural Protocols (Scripts)" text={selectedReportApt.prescription} accent="primary" />
                            <DocSec icon={<FileText size={20} />} title="Physician Observations" text={selectedReportApt.notes} />
                        </div>
                        <div className="p-12 border-t border-white/10 bg-white/5 flex justify-end">
                            <button onClick={() => setSelectedReportApt(null)} className="px-14 py-5 bg-white/5 border border-white/10 rounded-3xl text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] hover:bg-primary hover:text-white transition-all active:scale-95 italic shadow-lg">Terminate View</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TabButton = ({ active, onClick, label }) => (
    <button onClick={onClick} className={`pb-8 px-6 text-[11px] font-black uppercase tracking-[0.4em] border-b-2 transition-all duration-700 italic flex-shrink-0 ${active ? 'border-primary text-primary opacity-100' : 'border-transparent text-slate-600 hover:text-slate-400 opacity-60'}`}>{label}</button>
);

const DocSec = ({ icon, title, text, accent }) => text ? (
    <div className="space-y-5 animate-in slide-in-from-left-6 duration-1000">
        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] flex items-center gap-4 italic"><span className={`text-${accent || 'slate-500'} opacity-50`}>{icon}</span> {title}</h4>
        <div className={`bg-white/5 border border-white/5 rounded-[3.5rem] p-10 text-[15px] font-bold text-[var(--test-base)] leading-[1.8] italic border-l-8 border-l-${accent || 'primary'}/30 shadow-inner overflow-hidden break-words`}>{text}</div>
    </div>
) : null;

export default PatientDashboard;
