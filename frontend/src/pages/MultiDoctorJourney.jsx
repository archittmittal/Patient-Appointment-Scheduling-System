/**
 * Issue #43: Multi-Doctor Journey Page - PREMIUM OVERHAUL
 * Beautiful, high-end UI for tracking multi-specialist clinical cycles.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Route, MapPin, Users, Clock, ChevronRight, Plus, X,
    CheckCircle2, Circle, Building2, ArrowRight, Sparkles,
    Search, Navigation, Stethoscope, AlertCircle, Layers,
    MoveRight, Building, Map, Activity, Zap, Compass, ZapOff, Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

// Stop status config
const STOP_CONFIG = {
    pending: { label: 'Scheduled', color: 'slate', icon: Clock },
    checked_in: { label: 'At Station', color: 'primary', icon: MapPin },
    in_progress: { label: 'In Consultation', color: 'amber', icon: Activity },
    completed: { label: 'Visit Logged', color: 'emerald', icon: CheckCircle2 },
    skipped: { label: 'Bypassed', color: 'rose', icon: ZapOff }
};

// Stop Status Badge
const StopStatusBadge = ({ status }) => {
    const { label, color } = STOP_CONFIG[status] || STOP_CONFIG.pending;
    return (
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-${color}-500/20 bg-${color}-500/10 text-${color}-500`}>
            {label}
        </span>
    );
};

// Journey Stop Card
const JourneyStopCard = ({ stop, isActive, isLast, isNext }) => {
    const { icon: StatusIcon, color } = STOP_CONFIG[stop.status] || STOP_CONFIG.pending;
    
    return (
        <div className="flex gap-8 group/stop">
            {/* Timeline track */}
            <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all duration-700 relative ${
                    stop.status === 'completed' 
                        ? 'bg-emerald-500 shadow-xl shadow-emerald-500/20'
                        : stop.status === 'in_progress'
                        ? 'bg-primary shadow-2xl shadow-primary/30 ring-4 ring-primary/10'
                        : 'bg-white/5 border border-white/10'
                }`}>
                    {stop.status === 'in_progress' && (
                        <div className="absolute inset-0 rounded-[1.25rem] animate-ping bg-primary/20 -z-10"></div>
                    )}
                    {stop.status === 'completed' ? (
                        <CheckCircle2 className="text-white" size={20} strokeWidth={3} />
                    ) : (
                        <span className={`text-xs font-black ${stop.status === 'in_progress' ? 'text-white' : 'text-slate-500'}`}>
                            0{stop.stop_order}
                        </span>
                    )}
                </div>
                {!isLast && (
                    <div className={`w-[2px] h-20 transition-all duration-1000 ${
                        stop.status === 'completed' ? 'bg-gradient-to-b from-emerald-500 to-emerald-500/10' : 'bg-white/5'
                    }`} />
                )}
            </div>

            {/* Stop Content */}
            <div className={`flex-1 pb-10 ${!isLast ? '' : ''}`}>
                <div className={`glass-card p-6 rounded-[2.5rem] border-[var(--border-base)] transition-all duration-700 relative overflow-hidden ${
                    isActive ? 'border-primary/20 shadow-2xl shadow-primary/5 -translate-y-1' : 'opacity-60 hover:opacity-100'
                }`}>
                    {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>}
                    
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-${color}-500 shadow-inner`}>
                                <Stethoscope size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h4 className="font-black text-[var(--text-base)] text-sm tracking-tight uppercase ">Dr. {stop.doctor_name}</h4>
                                <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mt-1 ">{stop.specialty}</p>
                            </div>
                        </div>
                        <StopStatusBadge status={stop.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <LocationUnit icon={Building2} label="Building" value={stop.building || 'A'} />
                        <LocationUnit icon={Layers} label="Floor" value={stop.floor_number || '1'} />
                        <LocationUnit icon={Clock} label="Est. Sync" value={`${stop.estimated_duration_mins || 20}M`} />
                    </div>

                    {isNext && stop.status === 'pending' && (
                        <div className="mt-8 flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in slide-in-from-right duration-700">
                             <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                                <Compass size={18} className="animate-spin-slow" />
                             </div>
                             <div className="flex-1">
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Navigation Active</p>
                                <p className="text-[11px] font-bold text-slate-400">Proceed to Building {stop.building || 'A'}, Room {stop.location_room || 'G10'} for next check-in.</p>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LocationUnit = ({ icon: Icon, label, value }) => (
    <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-1 item-center justify-center text-center">
        <Icon size={12} className="text-slate-600 mx-auto" />
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-[11px] font-black text-[var(--text-base)] tracking-tight">{value}</p>
    </div>
);

// Active Journey Card
const ActiveJourneyCard = ({ journey, onClick }) => {
    const completedStops = journey.completed_stops || 0;
    const progress = Math.round((completedStops / journey.total_stops) * 100);
    const nextStop = journey.stops?.find(s => s.status === 'pending');

    return (
        <button
            onClick={onClick}
            className="w-full glass-card p-8 rounded-[3.5rem] border-[var(--border-base)] hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-700 text-left relative overflow-hidden group"
        >
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors"></div>
            
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/5 rounded-[2rem] flex items-center justify-center text-primary border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-700">
                        <Route size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-[var(--text-base)] tracking-tighter uppercase ">Registry Cycle: {journey.total_stops} Nodes</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2 ">
                            Sync Progress: <span className="text-primary">{completedStops} / {journey.total_stops} verified</span>
                        </p>
                    </div>
                </div>
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors border border-white/10 hover:border-primary/20">
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </div>
            </div>

            <div className="space-y-4 mb-8 relative z-10">
                <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                    <div 
                        className="h-full bg-gradient-to-r from-primary via-indigo-500 to-primary rounded-full transition-all duration-1000 shadow-lg shadow-primary/20"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
                    <span>Registry Initialization</span>
                    <span>{progress}% Integrated</span>
                    <span>Cycle Completion</span>
                </div>
            </div>

            {nextStop && (
                <div className="p-5 bg-white/5 border border-white/5 rounded-[2.5rem] flex items-center gap-5 relative z-10 hover:bg-white/10 transition-all">
                    <div className="w-12 h-12 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center animate-pulse">
                        <Navigation size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Active Navigator</p>
                        <p className="text-xs font-black text-[var(--text-base)] uppercase ">Next: Dr. {nextStop.doctor_name}</p>
                    </div>
                </div>
            )}
        </button>
    );
};

// Main Component
const MultiDoctorJourney = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [journeys, setJourneys] = useState([]);
    const [selectedJourney, setSelectedJourney] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctors, setSelectedDoctors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState(null);
    const [creationStep, setCreationStep] = useState(1);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [optimalPaths, setOptimalPaths] = useState([]);
    const [selectedPathIndex, setSelectedPathIndex] = useState(null);

    const filteredDoctors = suggestions?.suggestedSpecialties?.length > 0
        ? doctors.filter(d => suggestions.suggestedSpecialties.some(s => s?.trim().toLowerCase() === d.specialty?.trim().toLowerCase()))
        : doctors;

    useEffect(() => {
        const fetchJourneys = async () => {
            try {
                const data = await apiClient.get('/api/multi-doctor/journeys');
                setJourneys(Array.isArray(data) && !data.error ? data : []);
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        fetchJourneys();
    }, []);

    useEffect(() => {
        if (showCreateModal) {
            apiClient.get('/api/doctors')
                .then(data => {
                    if (data && !data.error) setDoctors(Array.isArray(data) ? data : []);
                })
                .catch(err => console.error(err));
        }
    }, [showCreateModal]);

    const handleSymptomSearch = async () => {
        if (!searchTerm.trim()) return;
        try {
            const data = await apiClient.get(`/api/multi-doctor/suggestions?symptom=${encodeURIComponent(searchTerm)}`);
            if (data && !data.error) setSuggestions(data);
        } catch (err) { console.error(err); }
    };

    const toggleDoctor = (doctor) => {
        setSelectedDoctors(prev => {
            const exists = prev.find(d => d.id === doctor.id);
            if (exists) return prev.filter(d => d.id !== doctor.id);
            return [...prev, doctor];
        });
    };

    const handleFindSlots = async () => {
        if (!selectedDate) return alert('Select sync date');
        setIsCreating(true);
        try {
            const data = await apiClient.post('/api/multi-doctor/coordinate-slots', { 
                doctorIds: selectedDoctors.map(d => d.id), 
                date: selectedDate 
            });
            if (data.error) throw new Error(data.error);
            setOptimalPaths(data);
            setCreationStep(2);
        } catch (err) { alert(err.message); } finally { setIsCreating(false); }
    };

    const handleCreateJourney = async () => {
        if (selectedPathIndex === null) return alert('Select optimal path');
        const path = optimalPaths[selectedPathIndex];
        setIsCreating(true);
        try {
            const data = await apiClient.post('/api/multi-doctor/journey', {
                appointments: path.items.map(item => ({
                    doctorId: item.doctorId,
                    reason: 'Clinical Consensus',
                    timeSlot: item.slot,
                    date: selectedDate
                }))
            });
            if (data.error) throw new Error(data.error || 'Sync failed');
            setJourneys(prev => [data, ...prev]);
            setShowCreateModal(false);
            resetCreationState();
        } catch (err) { alert(err.message); } finally { setIsCreating(false); }
    };

    const resetCreationState = () => {
        setSelectedDoctors([]);
        setSearchTerm('');
        setSuggestions(null);
        setCreationStep(1);
        setOptimalPaths([]);
        setSelectedPathIndex(null);
    };

    if (isLoading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse">Calculating Optimal Clinical Routes...</div>;

    // Details View
    if (selectedJourney) {
        const completedStops = selectedJourney.stops?.filter(s => s.status === 'completed').length || 0;
        const progress = Math.round((completedStops / selectedJourney.total_stops) * 100);
        const nextStopIdx = selectedJourney.stops?.findIndex(s => s.status === 'pending');

        return (
            <div className="max-w-3xl mx-auto pb-20 animate-in fade-in duration-700">
                <button
                    onClick={() => setSelectedJourney(null)}
                    className="flex items-center gap-3 text-slate-500 hover:text-[var(--text-base)] mb-10 transition-all font-black text-[10px] uppercase tracking-[0.3em] group"
                >
                    <ArrowRight size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    <span>Return to Registry Overview</span>
                </button>

                <div className="glass-modal rounded-[3.5rem] p-10 mb-12 border-none shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="flex flex-col md:flex-row items-center gap-8 mb-10 relative z-10">
                        <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                            <Route size={32} strokeWidth={2.5} />
                        </div>
                        <div className="text-center md:text-left">
                            <h2 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none mb-4">
                                Active Node Protocol
                            </h2>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ">
                                Cycle Sync: <span className="text-primary">{completedStops} / {selectedJourney.total_stops} Verified Stations</span>
                            </p>
                        </div>
                    </div>

                    <div className="glass-card rounded-[2.5rem] p-8 bg-white/5 border-white/5 relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ">Telemetry Stream</span>
                            <span className="text-xl font-black text-primary tabular-nums">{progress}%</span>
                        </div>
                        <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-1 mb-4">
                            <div 
                                className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-black text-slate-600 uppercase tracking-widest ">
                            <Clock size={12} /> Predicted End-of-Cycle: {selectedJourney.totalEstimatedMins || 60}M Telemetry
                        </div>
                    </div>
                </div>

                <div className="px-6 relative">
                     <div className="flex items-center gap-4 mb-10">
                        <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-600 border border-white/5"><Map size={16} /></div>
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] ">Clinical Route Matrix</h3>
                     </div>
                    <div className="space-y-4">
                        {selectedJourney.stops?.map((stop, idx) => (
                            <JourneyStopCard
                                key={stop.id}
                                stop={stop}
                                isActive={stop.status === 'in_progress' || (stop.status === 'pending' && idx === nextStopIdx)}
                                isNext={idx === nextStopIdx}
                                isLast={idx === selectedJourney.stops.length - 1}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                        <Route size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none">Route Optimizer</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 ">Multi-specialist clinical coordinate sync</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-2xl">
                    <div className="flex -space-x-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-10 h-10 rounded-xl border-4 border-[var(--bg-base)] overflow-hidden bg-slate-800">
                                <img src={`https://i.pravatar.cc/100?img=${i+40}`} alt="doctor" className="w-full h-full object-cover opacity-60" />
                            </div>
                        ))}
                    </div>
                    <div className="pr-2">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 text-right">Available</p>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest text-right ">Sync Ready</p>
                    </div>
                </div>
            </div>

            {/* Smart Banner */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-[2.5rem] p-10 mb-12 border-l-4 border-l-primary relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={100} /></div>
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="p-5 bg-primary text-white rounded-[1.75rem] shadow-2xl shadow-primary/30">
                        <Navigation size={24} className="animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tight mb-2">Neural Path Calibration</h3>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed opacity-80 max-w-lg">
                            Advanced telemetry algorithms minimize dwell times and optimize spatial movement across the clinical facility.
                        </p>
                    </div>
                </div>
            </div>

            {/* Active Journeys Registry */}
            {journeys.length > 0 && (
                <div className="mb-12">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-600 border border-white/5"><Layers size={16} /></div>
                        <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] ">Active Cycle Registry</h2>
                     </div>
                    <div className="space-y-8">
                        {journeys.map(journey => (
                            <ActiveJourneyCard
                                key={journey.id}
                                journey={journey}
                                onClick={() => setSelectedJourney(journey)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Initialize New Cycle Button */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="w-full p-12 bg-white/5 border-2 border-dashed border-white/5 rounded-[3.5rem] hover:border-primary/20 hover:bg-primary/5 transition-all duration-700 flex flex-col items-center justify-center gap-6 group"
            >
                <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 group-hover:bg-primary group-hover:text-white group-hover:rotate-90 transition-all duration-700 shadow-inner">
                    <Plus size={32} strokeWidth={3} />
                </div>
                <div className="text-center">
                    <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter mb-2">Initialize New Cycle</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] opacity-60">Aggregate multiple practitioners into a single registry</p>
                </div>
            </button>

            {/* Optimization Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
                <MetricCard icon={Navigation} color="primary" title="Zero Dwell" desc="Minimized waiting buffer between clinical nodes." />
                <MetricCard icon={Compass} color="emerald" title="Optimized Paths" desc="Spatial routing based on facility floor plan." />
                <MetricCard icon={Layers} color="amber" title="Unified Registry" desc="One check-in for multiple specialist sessions." />
            </div>

            {/* Create Wizard Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-500">
                    <div className="glass-modal rounded-[3.5rem] max-w-2xl w-full max-h-[85vh] overflow-hidden border-none shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col">
                        <div className="p-10 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2 ">Cycle Config: Step 0{creationStep}</p>
                                <h2 className="text-3xl font-black text-[var(--text-base)] tracking-tighter uppercase ">Registry Construction</h2>
                            </div>
                            <button
                                onClick={() => { setShowCreateModal(false); resetCreationState(); }}
                                className="p-4 bg-white/5 border border-white/10 text-slate-500 hover:text-white rounded-2xl hover:bg-white/10 transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10">
                            {creationStep === 1 ? (
                                <>
                                    {/* Symptom neural search */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block">Symptom Neural Feed (Optional)</label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                placeholder="Enter symptoms for auto-calibration..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 p-5 pl-14 rounded-3xl text-sm font-bold text-[var(--text-base)] focus:outline-none focus:border-primary/40 focus:bg-white/10 transition-all shadow-inner uppercase tracking-wider "
                                            />
                                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={20} />
                                            <button
                                                onClick={handleSymptomSearch}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-primary text-white rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all active:scale-95"
                                            >
                                                <Zap size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* AI Suggestions */}
                                    {suggestions?.suggestedSpecialties?.length > 0 && (
                                        <div className="p-8 bg-amber-500/5 border border-amber-500/20 rounded-[2.5rem] animate-in slide-in-from-left duration-700">
                                            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-3 ">
                                                <Sparkles size={16} className="animate-pulse" /> Neural Predictions
                                            </h4>
                                            <div className="flex items-center gap-4 flex-wrap">
                                                {suggestions.suggestedSpecialties.map((spec, idx) => (
                                                    <React.Fragment key={spec}>
                                                        <span className="px-4 py-2 bg-white/5 border border-amber-500/20 rounded-xl text-[10px] font-black text-amber-500 uppercase tracking-widest ">
                                                            {spec}
                                                        </span>
                                                        {idx < suggestions.suggestedSpecialties.length - 1 && (
                                                            <MoveRight size={14} className="text-amber-500/30" />
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Selection Matrix */}
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center px-2">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">Practitioner Matrix</h4>
                                            <span className="text-[10px] font-black text-primary uppercase ">{selectedDoctors.length} Selected</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {filteredDoctors.map(doctor => (
                                                <button
                                                    key={doctor.id}
                                                    onClick={() => toggleDoctor(doctor)}
                                                    className={`p-5 rounded-[2rem] border-2 text-left transition-all duration-500 relative overflow-hidden group/item ${
                                                        selectedDoctors.some(d => d.id === doctor.id) 
                                                            ? 'border-primary bg-primary/10 shadow-xl shadow-primary/5'
                                                            : 'border-white/5 bg-white/5 hover:border-white/20'
                                                    }`}
                                                >
                                                    {selectedDoctors.some(d => d.id === doctor.id) && <div className="absolute top-0 right-0 p-3 text-primary"><CheckCircle2 size={16} /></div>}
                                                    <div className="flex items-center gap-4 mb-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedDoctors.some(d => d.id === doctor.id) ? 'bg-primary text-white' : 'bg-white/5 text-slate-600'}`}>
                                                            <Stethoscope size={18} />
                                                        </div>
                                                        <div>
                                                            <h5 className="text-[11px] font-black text-[var(--text-base)] uppercase tracking-tight ">Dr. {doctor.name}</h5>
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ">{doctor.specialty}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 pt-3 border-t border-white/5 text-[8px] font-black text-slate-600 uppercase tracking-widest ">
                                                        <Building2 size={10} /> {doctor.building || 'A'} • F-{doctor.floor_number || 1}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-10 animate-in fade-in duration-700">
                                    {/* Date Config */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block">Cycle Baseline Date</label>
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-sm font-bold text-[var(--text-base)] focus:outline-none focus:border-primary/40 focus:bg-white/10 transition-all shadow-inner uppercase tracking-wider "
                                        />
                                    </div>

                                    {/* Optimized Path Options */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between px-2">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ">Calculated Protocols</h4>
                                            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                                {optimalPaths.length} Active Solutions
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-6">
                                            {optimalPaths.length === 0 ? (
                                                <div className="p-12 text-center bg-white/5 rounded-[3rem] border-2 border-dashed border-white/10">
                                                    <AlertCircle className="mx-auto text-slate-700 mb-6 opacity-20" size={48} />
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ">Zero path solutions found for selected criteria.</p>
                                                </div>
                                            ) : (
                                                optimalPaths.map((path, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setSelectedPathIndex(idx)}
                                                        className={`w-full p-8 rounded-[3rem] border-2 text-left transition-all duration-700 relative overflow-hidden group/path ${
                                                            selectedPathIndex === idx
                                                                ? 'border-primary bg-primary/10 shadow-2xl shadow-primary/5'
                                                                : 'border-white/5 bg-white/5 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${selectedPathIndex === idx ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-slate-600'}`}>
                                                                    <Compass size={20} strokeWidth={2.5} className={selectedPathIndex === idx ? 'animate-spin-slow' : ''} />
                                                                </div>
                                                                <span className="text-lg font-black text-[var(--text-base)] uppercase tracking-tighter">Path Solution: Delta-{idx + 1}</span>
                                                            </div>
                                                            <div className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 uppercase tracking-[0.2em] ">
                                                                {path.totalDurationMins}M Telemetry
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-4 flex-wrap relative z-10 px-2">
                                                            {path.items.map((item, i) => (
                                                                <React.Fragment key={i}>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[9px] text-primary font-black uppercase tracking-widest tabular-nums leading-none mb-1">{item.slot}</span>
                                                                        <span className="text-[11px] font-black text-slate-400 font-bold uppercase tracking-tight ">{item.doctorName.split(' ').pop()}</span>
                                                                    </div>
                                                                    {i < path.items.length - 1 && (
                                                                        <ArrowRight size={16} className="text-slate-700 opacity-40 mx-2" />
                                                                    )}
                                                                </React.Fragment>
                                                            ))}
                                                        </div>
                                                        {selectedPathIndex === idx && <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-10 border-t border-white/10 bg-white/5 backdrop-blur-md">
                            {creationStep === 1 ? (
                                <button
                                    onClick={handleFindSlots}
                                    disabled={selectedDoctors.length < 2 || isCreating}
                                    className="w-full py-6 bg-primary text-white text-[11px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                                >
                                    {isCreating ? 'Calibrating Path Vectors...' : (
                                        <span className="flex items-center justify-center gap-3 ">Initialize Schedule <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" /></span>
                                    )}
                                </button>
                            ) : (
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setCreationStep(1)}
                                        className="flex-1 py-6 bg-white/5 border border-white/10 text-slate-500 text-[11px] font-black uppercase tracking-[0.3em] rounded-[2rem] hover:bg-white/10 transition-all "
                                    >
                                        Back to Matrix
                                    </button>
                                    <button
                                        onClick={handleCreateJourney}
                                        disabled={selectedPathIndex === null || isCreating}
                                        className="flex-[2] py-6 bg-primary text-white text-[11px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed "
                                    >
                                        {isCreating ? 'Finalizing Registry...' : `Lock & Synchronize Cycle`}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MetricCard = ({ icon: Icon, color, title, desc }) => (
    <div className="glass-card p-8 rounded-[3rem] border-[var(--border-base)] hover:border-white/20 transition-all duration-700 group relative overflow-hidden">
        <div className={`p-4 bg-${color}-500/10 text-${color}-500 rounded-2xl w-fit mb-6 border border-${color}-500/10 group-hover:scale-110 transition-all duration-700 shadow-inner`}>
            <Icon size={24} strokeWidth={2.5} />
        </div>
        <h3 className="text-lg font-black text-[var(--text-base)] mb-3 uppercase tracking-tight ">{title}</h3>
        <p className="text-[10px] font-bold text-slate-600 leading-relaxed uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity ">{desc}</p>
    </div>
);

export default MultiDoctorJourney;
