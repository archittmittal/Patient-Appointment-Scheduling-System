/**
 * Issue #46: Patient Prep Checklist Page - PREMIUM OVERHAUL
 * Clinical Readiness Protocol interface for pre-visit synchronization.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    ClipboardCheck, CheckCircle2, Circle, AlertTriangle, Clock,
    Calendar, User, ChevronRight, Sparkles, ArrowRight,
    ChevronDown, ChevronUp, Star, Bell, ArrowLeft,
    Stethoscope, Heart, Eye, Syringe, FlaskConical, Pill,
    Activity, ShieldCheck, Zap, Compass, Info, Target
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const PriorityBadge = ({ priority }) => {
    const config = {
        required: { label: 'Mandatory', bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
        recommended: { label: 'Optimal', bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
        optional: { label: 'Elective', bg: 'bg-white/5', text: 'text-slate-500', border: 'border-white/5' }
    };
    const { label, bg, text, border } = config[priority] || config.optional;

    return (
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest italic border ${bg} ${text} ${border} shadow-inner transition-all duration-700`}>
            {label}
        </span>
    );
};

const PrepItem = ({ item, onToggle, isUpdating }) => {
    const handleClick = () => { if (!isUpdating) onToggle(item.id, !item.isCompleted); };

    return (
        <button
            onClick={handleClick}
            disabled={isUpdating}
            className={`group w-full flex items-center gap-6 p-6 rounded-[2.5rem] border transition-all duration-700 text-left relative overflow-hidden ${
                item.isCompleted
                    ? 'bg-emerald-500/5 border-emerald-500/20 shadow-inner'
                    : item.priority === 'required'
                    ? 'bg-white/5 border-rose-500/10 hover:border-rose-500/30'
                    : 'bg-white/5 border-white/5 hover:border-primary/20'
            } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
        >
            {item.isCompleted && <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl animate-pulse"></div>}
            
            <div className="flex-shrink-0 relative z-10 transition-transform duration-700 group-hover:scale-110">
                {item.isCompleted ? (
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-emerald-500/30 border border-emerald-400/20">
                        <CheckCircle2 size={24} strokeWidth={2.5} />
                    </div>
                ) : (
                    <div className={`w-12 h-12 border-2 rounded-[1.25rem] flex items-center justify-center transition-all duration-700 ${
                        item.priority === 'required' ? 'border-rose-500/30 bg-rose-500/5 text-rose-500' : 'border-white/10 bg-white/5 text-slate-700'
                    }`}>
                        <div className="w-2 h-2 rounded-full bg-current animate-pulse opacity-40"></div>
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl group-hover:rotate-12 transition-transform duration-700">{item.icon}</span>
                    <span className={`text-sm font-black uppercase italic tracking-tight ${item.isCompleted ? 'text-emerald-500 line-through opacity-60' : 'text-[var(--text-base)]'}`}>
                        {item.label}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <PriorityBadge priority={item.priority} />
                    {item.notes && (
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic opacity-60 truncate">
                            {item.notes}
                        </p>
                    )}
                </div>
            </div>
             <ChevronRight className={`text-slate-700 group-hover:translate-x-2 transition-transform duration-700 ${item.isCompleted ? 'text-emerald-500' : ''}`} size={20} />
        </button>
    );
};

const ProgressRing = ({ progress, size = 120, strokeWidth = 8 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    const getColor = () => {
        if (progress >= 100) return 'text-emerald-500';
        if (progress >= 75) return 'text-primary';
        if (progress >= 50) return 'text-amber-500';
        return 'text-rose-500';
    };

    return (
        <div className="relative inline-flex items-center justify-center group">
            <div className={`absolute inset-0 blur-2xl opacity-20 transition-colors duration-1000 ${getColor().replace('text-', 'bg-')}`}></div>
            <svg width={size} height={size} className="-rotate-90 relative z-10">
                <circle className="text-white/5" strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size/2} cy={size/2} />
                <circle className={`${getColor()} transition-all duration-1000 shadow-2xl`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx={size/2} cy={size/2} />
            </svg>
            <div className="absolute text-center relative z-10">
                <span className={`text-3xl font-black italic tracking-tighter tabular-nums ${getColor()}`}>{progress}<span className="text-sm ml-0.5 opacity-60">%</span></span>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] italic mt-1 pb-1">Ready</p>
            </div>
        </div>
    );
};

const AppointmentPrepCard = ({ appointment, onClick }) => {
    const progress = appointment.prepProgress?.percentage || 0;
    const allRequiredDone = (appointment.prepProgress?.requiredCompleted || 0) >= (appointment.prepProgress?.requiredTotal || 0);

    return (
        <button onClick={onClick} className="w-full glass-card rounded-[3rem] p-8 border border-white/5 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-700 text-left group relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Target size={48} /></div>
            <div className="flex items-center gap-8 relative z-10">
                <ProgressRing progress={progress} size={84} strokeWidth={6} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-[var(--text-base)] uppercase italic tracking-tighter truncate leading-none">Dr. {appointment.doctor_name}</h3>
                        {!allRequiredDone && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-lg shadow-rose-500/50"></div>}
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none mb-4">{appointment.specialty || 'Clinical Discipline'}</p>
                    
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest italic">
                            <Calendar size={14} strokeWidth={2.5} />
                            {new Date(appointment.appointment_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest italic">
                            <Clock size={14} strokeWidth={2.5} />
                            {appointment.appointment_time}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3 px-6 py-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] italic ${allRequiredDone ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {allRequiredDone ? 'Base Clear' : 'Input Req'}
                    </span>
                    <ChevronRight className="text-slate-700 group-hover:translate-x-2 transition-transform duration-700" size={20} />
                </div>
            </div>
        </button>
    );
};

const PrepChecklist = () => {
    const navigate = useNavigate();
    const { appointmentId } = useParams();
    const { user } = useAuth();
    
    const [overview, setOverview] = useState([]);
    const [selectedPrep, setSelectedPrep] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [expandedSection, setExpandedSection] = useState('required');

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (appointmentId) {
                    const res = await fetch(`${API}/api/prep/appointment/${appointmentId}`, { headers: authedHeaders() });
                    setSelectedPrep(await res.json());
                } else {
                    const res = await fetch(`${API}/api/prep/overview`, { headers: authedHeaders() });
                    const data = await res.json();
                    setOverview(Array.isArray(data) ? data : []);
                }
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        fetchData();
    }, [appointmentId]);

    const handleToggle = async (itemId, completed) => {
        if (!selectedPrep) return;
        setIsUpdating(true);
        try {
            await fetch(`${API}/api/prep/complete/${selectedPrep.appointment.id}/${itemId}`, { method: completed ? 'POST' : 'DELETE', headers: authedHeaders() });
            setSelectedPrep(prev => ({
                ...prev,
                items: prev.items.map(item => item.id === itemId ? { ...item, isCompleted: completed } : item),
                completedCount: prev.completedCount + (completed ? 1 : -1)
            }));
        } catch (err) { console.error(err); } finally { setIsUpdating(false); }
    };

    if (isLoading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse italic">Synchronizing Protocol Feed...</div>;

    if (selectedPrep) {
        const progress = selectedPrep.totalCount > 0 ? Math.round((selectedPrep.completedCount / selectedPrep.totalCount) * 100) : 100;
        const groupedItems = selectedPrep.items.reduce((acc, item) => {
            const key = item.priority || 'recommended';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

        return (
            <div className="max-w-2xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700 px-4">
                <button onClick={() => navigate('/prep-checklist')} className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic hover:text-primary transition-colors mb-6 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Matrix
                </button>

                <div className="glass-modal rounded-[3.5rem] p-10 bg-primary border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                        <ProgressRing progress={progress} size={110} strokeWidth={8} />
                        <div className="text-center md:text-left space-y-3">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Dr. {selectedPrep.appointment.doctorName}</h2>
                            <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.4em] italic leading-none">{selectedPrep.appointment.specialty}</p>
                            <div className="flex items-center justify-center md:justify-start gap-6 pt-4 border-t border-white/10">
                                <div className="flex items-center gap-2 text-[9px] font-black text-white/80 uppercase tracking-widest italic">
                                    <Calendar size={14} className="text-primary-light" /> {new Date(selectedPrep.appointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-black text-white/80 uppercase tracking-widest italic">
                                    <Clock size={14} className="text-primary-light" /> {selectedPrep.appointment.time}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {['required', 'recommended', 'optional'].map(section => groupedItems[section]?.length > 0 && (
                    <div key={section} className="space-y-6">
                        <button
                            onClick={() => setExpandedSection(expandedSection === section ? '' : section)}
                            className="w-full flex items-center justify-between px-4 group"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-inner ${
                                    section === 'required' ? 'bg-rose-500/10 text-rose-500' : 
                                    section === 'recommended' ? 'bg-amber-500/10 text-amber-500' : 'bg-white/5 text-slate-500'
                                }`}>
                                    {section === 'required' ? <AlertTriangle size={18} /> : section === 'recommended' ? <Star size={18} /> : <ClipboardCheck size={18} />}
                                </div>
                                <div className="text-left">
                                    <h3 className="text-[11px] font-black text-[var(--text-base)] uppercase tracking-[0.4em] italic leading-none mb-1">{section} Protocol</h3>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic">{groupedItems[section].filter(i=>i.isCompleted).length} / {groupedItems[section].length} Synchronized</p>
                                </div>
                            </div>
                            {expandedSection === section ? <ChevronUp size={20} className="text-primary" /> : <ChevronDown size={20} className="text-slate-700" />}
                        </button>
                        {expandedSection === section && (
                            <div className="space-y-4 animate-in slide-in-from-top-4 duration-700">
                                {groupedItems[section].map(item => <PrepItem key={item.id} item={item} onToggle={handleToggle} isUpdating={isUpdating} />)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700 px-4">
            <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner">
                    <ClipboardCheck size={32} strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none mb-3">Protocol Matrix</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Pre-appointment clinical readiness synchronization</p>
                </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-[2.5rem] p-8 flex items-start gap-6 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={48} /></div>
                <div className="w-16 h-16 bg-white shadow-2xl shadow-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 flex-shrink-0 group-hover:rotate-12 transition-transform duration-700">
                    <Sparkles size={28} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-amber-600 uppercase tracking-tighter italic mb-2">Registry Efficiency Opt</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic leading-relaxed">Complete your readiness protocol before arrival for zero-latency clinical entry.</p>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] italic px-2 flex items-center gap-3">
                    <Calendar className="text-primary" size={16} /> Upcoming Cycle Preparations
                </h2>

                {overview.length > 0 ? (
                    <div className="space-y-6">
                        {overview.map((apt) => <AppointmentPrepCard key={apt.id} appointment={apt} onClick={() => navigate(`/prep-checklist/${apt.id}`)} />)}
                    </div>
                ) : (
                    <div className="py-24 text-center glass-modal rounded-[3.5rem] border-none shadow-2xl space-y-8">
                        <Compass size={64} className="text-slate-700/20 mx-auto" />
                        <h3 className="text-xl font-black text-slate-500 uppercase italic tracking-tighter">No Active Protocols</h3>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">Awaiting new clinical appointment synchronization.</p>
                        <button onClick={() => navigate('/book')} className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-[1.75rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all italic flex items-center gap-4 mx-auto">
                            Sync New Appointment <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="glass-card rounded-[3.5rem] p-10 border-white/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Info size={48} /></div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mb-10 italic px-2">Legend Calibration</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <LegendModule icon={AlertTriangle} color="rose" label="Mandatory" desc="Critical sync requirements." />
                    <LegendModule icon={Star} color="amber" label="Optimal" desc="Enhanced consultation prep." />
                    <LegendModule icon={Bell} color="emerald" label="Registry" desc="Push notification sync." />
                </div>
            </div>
        </div>
    );
};

const LegendModule = ({ icon: Icon, color, label, desc }) => (
    <div className="flex items-start gap-4">
        <div className={`p-3 bg-${color}-500/10 text-${color}-500 rounded-xl border border-${color}-500/20 shadow-inner`}>
            <Icon size={16} strokeWidth={2.5} />
        </div>
        <div>
            <h4 className="text-[10px] font-black text-[var(--text-base)] uppercase tracking-widest italic mb-1">{label}</h4>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] italic opacity-60 leading-none">{desc}</p>
        </div>
    </div>
);

export default PrepChecklist;
