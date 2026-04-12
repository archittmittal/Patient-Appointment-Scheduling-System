/**
 * Issue #49: Batch Appointments Page - PREMIUM OVERHAUL
 * Multi-Node Registry for high-fidelity clinical mass-synchronization.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Layers, Calendar, Clock, Users, ChevronRight, Search,
    Syringe, Stethoscope, ClipboardCheck, FlaskConical, Pill,
    User, MapPin, CheckCircle2, AlertCircle, Sparkles,
    ArrowRight, Filter, X, Plus, Zap, ShieldCheck, Activity,
    Target, Compass, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const BATCH_TYPE_CONFIG = {
    VACCINATION: { icon: Syringe, color: 'emerald', label: 'Immunity Protocol' },
    ROUTINE_CHECKUP: { icon: Stethoscope, color: 'blue', label: 'Clinical Scry' },
    FOLLOWUP: { icon: ClipboardCheck, color: 'violet', label: 'Recalibration' },
    LAB_REVIEW: { icon: FlaskConical, color: 'amber', label: 'Serum Audit' },
    PRESCRIPTION_REFILL: { icon: Pill, color: 'pink', label: 'Node Recharge' }
};

const getColorClasses = (color) => {
    const colorMap = {
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', gradient: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/20' },
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', gradient: 'from-blue-400 to-blue-600', shadow: 'shadow-blue-500/20' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/20', gradient: 'from-violet-400 to-violet-600', shadow: 'shadow-violet-500/20' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20', gradient: 'from-amber-400 to-amber-600', shadow: 'shadow-amber-500/20' },
        pink: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20', gradient: 'from-rose-400 to-rose-600', shadow: 'shadow-rose-500/20' }
    };
    return colorMap[color] || colorMap.blue;
};

const BatchTypeCard = ({ type, isSelected, onClick }) => {
    const config = BATCH_TYPE_CONFIG[type.id] || BATCH_TYPE_CONFIG.ROUTINE_CHECKUP;
    const colors = getColorClasses(config.color);
    const Icon = config.icon;

    return (
        <button
            onClick={() => onClick(type.id)}
            className={`p-6 rounded-[2rem] border transition-all duration-700 text-left w-full group relative overflow-hidden ${
                isSelected 
                    ? `${colors.border} ${colors.bg} scale-[1.02] shadow-2xl ${colors.shadow}`
                    : 'border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10'
            }`}
        >
            <div className={`w-12 h-12 rounded-2xl ${colors.bg} flex items-center justify-center mb-6 border ${colors.border} shadow-inner group-hover:rotate-6 transition-transform`}>
                <Icon className={colors.text} size={24} strokeWidth={2.5} />
            </div>
            <h4 className={`font-black text-[var(--test-base)] text-sm uppercase italic tracking-tighter ${isSelected ? colors.text : ''}`}>{config.label}</h4>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 italic opacity-60 leading-tight">{type.description}</p>
            <div className="mt-6 flex items-center gap-3 text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] italic">
                <Users size={14} className={colors.text} />
                <span>LIMIT: {type.maxBatchSize} PX</span>
            </div>
            {isSelected && <div className={`absolute top-0 right-0 p-4 ${colors.text}`}><CheckCircle2 size={20} /></div>}
        </button>
    );
};

const BatchSlotCard = ({ slot, onBook, isBooking }) => {
    const config = BATCH_TYPE_CONFIG[slot.batch_type] || BATCH_TYPE_CONFIG.ROUTINE_CHECKUP;
    const colors = getColorClasses(config.color);
    const Icon = config.icon;
    const available = slot.max_capacity - (slot.current_count || slot.booked_count || 0);
    const isFull = available <= 0;

    return (
        <div className={`glass-modal p-8 border-none shadow-2xl relative overflow-hidden group transition-all duration-700 rounded-[3rem] ${isFull ? 'opacity-40 grayscale' : 'hover:shadow-primary/10'}`}>
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colors.gradient} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center border ${colors.border} shadow-inner group-hover:rotate-12 transition-transform`}>
                        <Icon className={colors.text} size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-[var(--test-base)] uppercase italic tracking-tighter">{config.label}</h4>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic mt-1 leading-none">Dr. {slot.doctor_name}</p>
                    </div>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border italic ${
                    isFull ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-primary/10 border-primary/20 text-primary animate-pulse'
                }`}>
                    {isFull ? 'CAPACITY REACHED' : `${available} SLOTS OPEN`}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest italic bg-white/5 px-4 py-3 rounded-2xl border border-white/5">
                    <Calendar size={16} className="text-primary" />
                    {new Date(slot.slot_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest italic bg-white/5 px-4 py-3 rounded-2xl border border-white/5">
                    <Clock size={16} className="text-primary" />
                    {slot.start_time.substring(0, 5)} MST
                </div>
            </div>

            <div className="mb-10 px-2">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3 italic opacity-60">
                    <span>REGISTRY VOLUME</span>
                    <span>{slot.current_count || slot.booked_count || 0}/{slot.max_capacity}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div 
                        className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all duration-1000 shadow-lg ${colors.shadow}`}
                        style={{ width: `${((slot.current_count || slot.booked_count || 0) / slot.max_capacity) * 100}%` }}
                    />
                </div>
            </div>

            <button
                onClick={() => onBook(slot.id)}
                disabled={isFull || isBooking}
                className={`w-full py-5 rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 italic group/btn ${
                    isFull 
                        ? 'bg-white/5 border border-white/5 text-slate-600 cursor-not-allowed'
                        : `bg-primary text-white shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1`
                }`}
            >
                {isFull ? 'NODE SATURATED' : (
                    <>
                        <Plus size={18} strokeWidth={3} className="group-hover/btn:rotate-90 transition-transform" />
                        Initiate Registration
                    </>
                )}
            </button>
        </div>
    );
};

const SuccessModal = ({ booking, onClose }) => {
    if (!booking) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="glass-modal rounded-[4rem] p-16 w-full max-w-md border-none shadow-2xl animate-in zoom-in-95 duration-500 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5"><Zap size={80} /></div>
                <div className="w-24 h-24 bg-primary text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-primary/30 border border-primary-light/20 rotate-12 transition-transform animate-bounce-slow">
                    <CheckCircle2 size={48} strokeWidth={2.5} />
                </div>
                <h3 className="text-3xl font-black text-[var(--test-base)] uppercase italic tracking-tighter mb-4">Registry Success</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10 italic max-w-xs mx-auto leading-relaxed">{booking.message}</p>
                <div className="bg-primary/10 rounded-[2.5rem] p-10 mb-10 border border-primary/20 shadow-inner group transition-all duration-700 hover:bg-primary/20">
                    <p className="text-7xl font-black text-primary tracking-tighter italic tabular-nums leading-none">#{booking.position}</p>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] mt-6 italic">Batch Vector Position</p>
                </div>
                <button onClick={onClose} className="w-full py-6 bg-primary text-white rounded-[2rem] font-black text-[12px] uppercase tracking-[0.4em] italic shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all">Clear Connection</button>
            </div>
        </div>
    );
};

const BatchAppointments = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [batchTypes, setBatchTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [slots, setSlots] = useState([]);
    const [myAppointments, setMyAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isBooking, setIsBooking] = useState(false);
    const [successBooking, setSuccessBooking] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [typesRes, myAptRes] = await Promise.all([
                    fetch(`${API}/api/batching/types`, { headers: authedHeaders() }),
                    fetch(`${API}/api/batching/my-appointments`, { headers: authedHeaders() })
                ]);
                const types = await typesRes.json();
                const myApts = await myAptRes.json();
                setBatchTypes(Array.isArray(types) ? types : []);
                setMyAppointments(Array.isArray(myApts) ? myApts : []);
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!searchTerm && !selectedType) { setSlots([]); return; }
        const fetchSlots = async () => {
            try {
                let url = searchTerm ? `${API}/api/batching/suggest?appointmentType=${encodeURIComponent(searchTerm)}` : `${API}/api/batching/slots/all/${new Date().toISOString().split('T')[0]}`;
                const res = await fetch(url, { headers: authedHeaders() });
                const data = await res.json();
                setSlots(searchTerm ? (data.suggestions || []) : (Array.isArray(data) ? data : []));
            } catch (err) { console.error(err); }
        };
        const debounce = setTimeout(fetchSlots, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, selectedType]);

    const handleBook = async (slotId) => {
        setIsBooking(true);
        try {
            const res = await fetch(`${API}/api/batching/book/${slotId}`, { method: 'POST', headers: authedHeaders(), body: JSON.stringify({ reason: searchTerm || selectedType }) });
            if (!res.ok) throw new Error((await res.json()).error || 'Registry Failure');
            setSuccessBooking(await res.json());
            const myRes = await fetch(`${API}/api/batching/my-appointments`, { headers: authedHeaders() });
            setMyAppointments(await myRes.json());
        } catch (err) { alert(err.message); } finally { setIsBooking(false); }
    };

    if (isLoading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse italic">Synchronizing Batch Registry...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000 px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 group">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 transition-transform duration-700">
                        <Layers size={36} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--test-base)] tracking-tighter uppercase italic leading-none">Multi-Node Registry</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 italic leading-none opacity-60">High-fidelity mass clinical synchronization cluster</p>
                    </div>
                </div>
                <button onClick={() => navigate('/book')} className="px-8 py-4 bg-white/5 border border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] rounded-2xl hover:bg-primary hover:text-white transition-all italic flex items-center gap-3">
                    <Calendar size={16} /> Individual Booking
                </button>
            </div>

            {myAppointments.length > 0 && (
                <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5"><Activity size={64} /></div>
                    <h2 className="text-2xl font-black text-[var(--test-base)] uppercase italic tracking-tighter mb-10 flex items-center gap-5">
                        <span className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner border border-primary/20"><Layers size={20} /></span>
                        Active Multi-Node Synchronizations
                    </h2>
                    <div className="grid gap-8 sm:grid-cols-2">
                        {myAppointments.map(apt => (
                            <div key={apt.id} className="p-8 rounded-[2.5rem] bg-white/5 border border-white/5 flex flex-col justify-between hover:bg-white/10 transition-all duration-700 group/item relative overflow-hidden">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 text-primary group-hover/item:rotate-12 transition-all"><Zap size={20} /></div>
                                    <div className="flex-1">
                                        <h4 className="text-lg font-black text-[var(--test-base)] uppercase italic tracking-tighter leading-none">{apt.batch_type_name || 'Clinical Batch'}</h4>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 italic">DR. {apt.doctor_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest italic">{new Date(apt.slot_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mt-1 italic opacity-60">{apt.start_time.substring(0,5)} MST</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] italic">QUEUE POS: <strong className="text-primary text-xl ml-2 tracking-tighter tabular-nums">#{apt.queue_position}</strong></span>
                                    <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 italic`}>{apt.status?.replace('_', ' ')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5"><Filter size={64} /></div>
                <h3 className="text-2xl font-black text-[var(--test-base)] uppercase tracking-tighter mb-10 italic flex items-center gap-5">
                    <span className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner border border-primary/20"><Search size={24} /></span>
                    Global Discovery Matrix
                </h3>
                <div className="relative mb-12">
                    <Search size={24} className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                    <input type="text" placeholder="QUERY PROTOCOLS (E.G., VACCINATION, FOLLOW-UP)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-20 pr-8 py-7 bg-white/5 border border-white/5 rounded-[2.5rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-[0.2em] focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 italic shadow-inner" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
                    {batchTypes.map(type => <BatchTypeCard key={type.id} type={type} isSelected={selectedType === type.id} onClick={(id) => setSelectedType(selectedType === id ? null : id)} />)}
                </div>
            </div>

            {(searchTerm || selectedType) && (
                <div className="space-y-10 animate-in slide-in-from-bottom-10">
                    <h2 className="text-2xl font-black text-[var(--test-base)] uppercase italic tracking-tighter flex items-center gap-5 pl-4">
                        <Sparkles className="text-amber-500 animate-pulse" size={24} />
                        Available Registry Nodes
                    </h2>
                    {slots.length > 0 ? (
                        <div className="grid gap-10 sm:grid-cols-2">
                            {slots.map(slot => <BatchSlotCard key={slot.id} slot={slot} onBook={handleBook} isBooking={isBooking} />)}
                        </div>
                    ) : (
                        <div className="glass-modal p-24 text-center rounded-[4rem] border-none shadow-2xl opacity-60">
                            <Compass size={64} className="text-slate-700/20 mx-auto mb-8" />
                            <h3 className="text-xl font-black text-slate-500 uppercase italic tracking-tighter">No Nodes Detected</h3>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic mt-4">Adjust registry parameters for discovery.</p>
                        </div>
                    )}
                </div>
            )}

            <div className="glass-card rounded-[3.5rem] p-12 border-none bg-white/5 relative overflow-hidden group shadow-2xl">
                 <div className="absolute top-0 right-0 p-12 opacity-5"><Info size={64} /></div>
                <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                    <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                        <ShieldCheck size={40} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-[var(--test-base)] uppercase italic tracking-tighter mb-4">Registry Efficiency Protocol</h4>
                        <div className="grid sm:grid-cols-3 gap-8">
                            <BenefitNode icon={<Clock />} title="Zero Latency" text="Optimized slots minimize wait cycles." />
                            <BenefitNode icon={<Users />} title="Group Sync" text="Like-nodes processed in parallel." />
                            <BenefitNode icon={<Zap />} title="Fixed Reservation" text="Neural priority lock per batch." />
                        </div>
                    </div>
                </div>
            </div>

            <SuccessModal booking={successBooking} onClose={() => setSuccessBooking(null)} />
        </div>
    );
};

const BenefitNode = ({ icon, title, text }) => (
    <div className="space-y-2">
        <div className="flex items-center gap-3 text-primary">
            {React.cloneElement(icon, { size: 16, strokeWidth: 3 })}
            <h5 className="text-[11px] font-black uppercase tracking-widest leading-none">{title}</h5>
        </div>
        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest italic opacity-60 leading-tight">{text}</p>
    </div>
);

export default BatchAppointments;
