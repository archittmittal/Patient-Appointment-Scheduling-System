/**
 * Issue #43: Secure Booking Page - PREMIUM OVERHAUL & STABILIZATION
 * High-fidelity clinical reservation matrix with real-time slot telemetry.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, 
    CheckCircle2, Users, Bell, ArrowRight, Sparkles, AlertCircle,
    Activity, ShieldCheck, Zap, Compass, MapPin, Search, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';
import { safeFetch } from '../utils/apiHelper';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const parseAvailability = (av) => {
    if (!av) return null;
    try {
        return typeof av === 'string' ? JSON.parse(av) : av;
    } catch (e) {
        console.error('[Booking] Availability parse error:', e);
        return null;
    }
};

const getDayOfWeek = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return DAY_NAMES[new Date(y, m - 1, d).getDay()];
};

const generateHourlySlots = (from, to) => {
    if (!from || !to) return [];
    try {
        const [fh] = from.split(':').map(Number);
        const [th] = to.split(':').map(Number);
        const slots = [];
        for (let h = fh; h < th; h++) {
            slots.push({
                label: `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`,
                hour: h,
            });
        }
        return slots;
    } catch (e) {
        return [];
    }
};

const TimeSlot = ({ slot, isSelected, isFull, booked, capacity, onClick }) => (
    <button
        onClick={isFull ? undefined : onClick}
        disabled={isFull}
        className={`group p-4 rounded-[1.75rem] text-[10px] font-black uppercase tracking-widest transition-all duration-700 border flex flex-col items-center gap-2 relative overflow-hidden ${
            isFull
                ? 'bg-white/5 text-slate-600 cursor-not-allowed border-[var(--border-base)] opacity-40'
                : isSelected
                    ? 'bg-primary text-white shadow-2xl shadow-primary/30 border-primary -translate-y-1 z-10 scale-105'
                    : 'bg-white/5 text-slate-500 hover:border-primary/40 hover:text-primary border-[var(--border-base)] hover:bg-white/10'
        }`}
    >
        {isSelected && <div className="absolute top-0 right-0 w-12 h-12 bg-white/20 rounded-full blur-xl"></div>}
        <span className="relative z-10">{slot.label.replace(' – ', '-')}</span>
        <span className={`relative z-10 text-[9px] px-2.5 py-1 rounded-lg border transition-colors ${
            isFull 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                : isSelected 
                    ? 'bg-white/20 border-white/20 text-white' 
                    : 'bg-primary/5 border-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-700'
        }`}>
            {isFull ? 'Limit Reached' : `${booked}/${capacity} Synched`}
        </span>
    </button>
);

const BookAppointment = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [slotCounts, setSlotCounts] = useState({});
    const [symptoms, setSymptoms] = useState('');
    const [isBooked, setIsBooked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [blockedDates, setBlockedDates] = useState(new Set());
    const [bookingResult, setBookingResult] = useState(null);
    
    const [waitlistJoining, setWaitlistJoining] = useState(false);
    const [waitlistJoined, setWaitlistJoined] = useState(false);
    const [waitlistTimePreference, setWaitlistTimePreference] = useState('ANY');

    useEffect(() => {
        const fetchDocs = async () => {
            const data = await safeFetch(`${API}/api/doctors`);
            if (Array.isArray(data)) {
                const pruned = data.filter(d => d && typeof d === 'object' && d.id);
                setDoctors(pruned);
                if (pruned.length > 0) setSelectedDoctor(pruned[0].id);
            }
        };
        fetchDocs();
    }, []);

    useEffect(() => {
        setSelectedSlot(null);
        setSlotCounts({});
        setBlockedDates(new Set());
        if (!selectedDoctor) return;
        
        const fetchBlocked = async () => {
            const data = await safeFetch(`${API}/api/doctors/${selectedDoctor}/blocked-dates`);
            if (Array.isArray(data)) {
                setBlockedDates(new Set(data.map(d => d.blocked_date.slice(0, 10))));
            }
        };
        fetchBlocked();
    }, [selectedDoctor]);

    useEffect(() => {
        if (!selectedDoctor || !selectedDate) return;
        setSelectedSlot(null);
        setWaitlistJoined(false);
        
        const fetchSlots = async () => {
            const data = await safeFetch(`${API}/api/doctors/${selectedDoctor}/slot-counts?date=${selectedDate}`, {}, {});
            setSlotCounts(data);
        };
        fetchSlots();
    }, [selectedDoctor, selectedDate]);

    const handleJoinWaitlist = async () => {
        if (!selectedDoctor || !selectedDate) return;
        setWaitlistJoining(true);
        try {
            const res = await fetch(`${API}/api/appointments/waitlist/join`, {
                method: 'POST',
                headers: authedHeaders(true),
                body: JSON.stringify({
                    doctorId: selectedDoctor,
                    preferredDate: selectedDate,
                    timePreference: waitlistTimePreference,
                    maxNoticeHours: 24,
                    reason: symptoms || 'Earlier availability calibration'
                })
            });
            if (res.ok) setWaitlistJoined(true);
        } catch (err) { console.error(err); } finally { setWaitlistJoining(false); }
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    const selectedDoctorObj = doctors.find(d => String(d.id) === String(selectedDoctor));
    const doctorAvail = parseAvailability(selectedDoctorObj?.availability);
    const capacity = selectedDoctorObj?.max_patients_per_slot || 15;

    const isDocClosed = (dateStr) => {
        const day = getDayOfWeek(dateStr);
        return doctorAvail && doctorAvail[day] && !doctorAvail[day].open;
    };

    const currentDayAvail = selectedDate && doctorAvail ? doctorAvail[getDayOfWeek(selectedDate)] : null;
    const allSlots = currentDayAvail?.open ? generateHourlySlots(currentDayAvail.from, currentDayAvail.to) : [];
    const morningSlots = allSlots.filter(s => s.hour < 12);
    const afternoonSlots = allSlots.filter(s => s.hour >= 12);

    if (isBooked) {
        return (
            <div className="max-w-3xl mx-auto p-10 animate-in zoom-in-95 duration-700">
                <div className="glass-modal rounded-[3.5rem] p-16 text-center border-none relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-500/30 animate-bounce">
                        <CheckCircle2 size={48} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic mb-4">Reservation Indexed</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-12 italic">Your session with Dr. {selectedDoctorObj?.first_name} {selectedDoctorObj?.last_name} has been synchronized.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-lg mx-auto mb-12">
                        <div className="glass-card p-8 bg-white/5 border-[var(--border-base)] rounded-[2.5rem]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic mb-3">Sync Date</p>
                            <p className="text-xl font-black text-[var(--test-base)] uppercase italic tracking-tighter">{selectedDate}</p>
                        </div>
                        <div className="glass-card p-8 bg-white/5 border-[var(--border-base)] rounded-[2.5rem]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic mb-3">Telemetry Node</p>
                            <p className="text-xl font-black text-[var(--test-base)] uppercase italic tracking-tighter">{selectedSlot}</p>
                        </div>
                    </div>

                    {bookingResult && (
                        <div className="bg-primary/5 border border-primary/20 rounded-[3rem] p-10 max-w-lg mx-auto mb-12 relative overflow-hidden group">
                             <div className="absolute top-0 left-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={64} /></div>
                            <p className="text-[10px] font-black text-primary mb-8 flex items-center justify-center gap-3 uppercase tracking-[0.4em] italic">
                                <Sparkles size={16} /> Clinical Intelligence Metrics
                            </p>
                            <div className="grid grid-cols-2 gap-10 text-center">
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic opacity-60 mb-2">Duration Prop.</p>
                                    <p className="text-3xl font-black text-primary italic">~{bookingResult.predictedDuration || 15}M</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic opacity-60 mb-2">Registry Rank</p>
                                    <p className="text-3xl font-black text-primary italic">#{bookingResult.queueNumber || '1'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row gap-5 max-w-lg mx-auto">
                        <button onClick={() => navigate('/live-queue')} className="flex-1 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all italic flex items-center justify-center gap-3">
                            Live Stream <ArrowRight size={16} className="animate-pulse" />
                        </button>
                        <button onClick={() => navigate('/patient-dashboard')} className="flex-1 py-5 bg-white/5 text-slate-400 border border-white/5 font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-white/10 transition-all italic">
                            Core Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const SlotGroup = ({ label, slots }) => slots.length > 0 && (
        <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3 italic leading-none ml-2">
                <Sparkles size={14} className="text-primary" /> {label} Frequency
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {slots.map(s => {
                    const booked = (slotCounts && slotCounts[s.label]) || 0;
                    return (
                        <TimeSlot
                            key={s.label}
                            slot={s}
                            isSelected={selectedSlot === s.label}
                            isFull={booked >= capacity}
                            booked={booked}
                            capacity={capacity}
                            onClick={() => setSelectedSlot(s.label)}
                        />
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                        <CalendarIcon size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--test-base)] tracking-tighter uppercase italic leading-none mb-3">Registry Matrix</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">High-fidelity clinical synchronization interface</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl">
                     <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner"><ShieldCheck size={20} /></div>
                     <div className="pr-4">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-right italic leading-none mb-1">Status</p>
                        <p className="text-[11px] font-black text-primary uppercase tracking-widest text-right italic leading-none">Live Sync Active</p>
                     </div>
                </div>
            </div>

            <div className="glass-modal rounded-[3.5rem] p-12 border-none shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                
                 {/* Doctor Interface */}
                <div className="pb-12 border-b border-white/5 space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-600"><Search size={16} /></div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Consultant Calibration</label>
                    </div>
                    <div className="relative group">
                        <select
                            value={selectedDoctor}
                            onChange={e => setSelectedDoctor(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] px-8 py-6 text-[var(--text-base)] font-black uppercase tracking-[0.2em] focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all outline-none appearance-none italic shadow-inner relative z-10"
                        >
                            <option value="" disabled className="bg-slate-900">Select Consultant Node...</option>
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id} className="bg-slate-900 text-white">DR. {doc.first_name} {doc.last_name} — {doc.specialty}</option>
                            ))}
                        </select>
                        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-primary opacity-40 group-hover:opacity-100 transition-opacity z-20"><Compass size={24} /></div>
                    </div>

                    {selectedDoctorObj && (
                        <div className="flex flex-col md:flex-row items-center justify-between mt-8 p-8 bg-white/5 rounded-[3rem] border border-white/5 group-hover:border-primary/20 transition-all duration-700 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-20 h-20 rounded-[1.75rem] overflow-hidden border-2 border-white/5 group-hover:border-primary/30 transition-all p-1 bg-white/5">
                                    <img src={selectedDoctorObj.image_url || `https://ui-avatars.com/api/?name=${selectedDoctorObj.first_name}+${selectedDoctorObj.last_name}&background=1e293b&color=fff`} className="w-full h-full object-cover rounded-[1.5rem]" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-[var(--test-base)] uppercase tracking-tighter italic leading-none">Dr. {selectedDoctorObj.first_name} {selectedDoctorObj.last_name}</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest italic leading-none">{selectedDoctorObj.specialty}</span>
                                        <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">{selectedDoctorObj.location_room}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 md:mt-0 flex flex-col items-end gap-2 px-8 py-4 bg-primary/10 rounded-[1.5rem] border border-primary/20 relative z-10">
                                <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em] italic opacity-60">Unit Capacity</span>
                                <span className="text-xl font-black text-primary italic tracking-tight">{capacity} PKT/Cycle</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-12 flex flex-col xl:flex-row gap-16 relative z-10">
                    <div className="flex-1 space-y-10">
                        <div className="flex justify-between items-center bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                            <h4 className="text-[11px] font-black text-[var(--test-base)] uppercase tracking-[0.4em] flex items-center gap-3 italic">
                                <CalendarIcon size={18} className="text-primary" /> Matrix Date
                            </h4>
                            <div className="flex items-center gap-8">
                                <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 hover:bg-primary hover:text-white transition-all shadow-inner"><ChevronLeft size={20} /></button>
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] italic min-w-[140px] text-center">{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 hover:bg-primary hover:text-white transition-all shadow-inner"><ChevronRight size={20} /></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-3 text-center">
                            {days.map(day => <div key={day} className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic mb-2">{day}</div>)}
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(date => {
                                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                                const isPast = new Date(year, month, date) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                const closed = !isPast && isDocClosed(dStr);
                                const isBlocked = !isPast && blockedDates.has(dStr);
                                const disabled = isPast || closed || isBlocked;
                                return (
                                    <button
                                        key={date}
                                        disabled={disabled}
                                        onClick={() => setSelectedDate(dStr)}
                                        className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-[11px] font-black transition-all duration-700 border uppercase italic
                                            ${selectedDate === dStr ? 'bg-primary text-white shadow-2xl shadow-primary/30 border-primary scale-110 z-10' : 
                                              isBlocked ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 cursor-not-allowed opacity-40' :
                                              disabled ? 'text-slate-800 opacity-10 cursor-not-allowed border-transparent' : 'bg-white/5 text-slate-500 border-white/5 hover:border-primary/40 hover:text-primary hover:bg-white/10 shadow-inner'}`}
                                    >
                                        {date}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="hidden xl:block w-[1px] bg-white/5"></div>

                    <div className="flex-1 space-y-12">
                        <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
                            <h4 className="text-[11px] font-black text-[var(--test-base)] uppercase tracking-[0.4em] flex items-center gap-3 italic">
                                <Clock size={18} className="text-primary" /> Availability Grid
                            </h4>
                        </div>
                        {!selectedDate ? (
                            <div className="py-20 text-center glass-card rounded-[3rem] border-dashed border-white/10 flex flex-col items-center gap-6 animate-pulse">
                                <Compass size={48} className="text-slate-700 opacity-20" />
                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] italic">Awaiting Matrix Baseline Calibration...</p>
                            </div>
                        ) : currentDayAvail && !currentDayAvail.open ? (
                            <div className="p-10 bg-rose-500/5 border border-rose-500/20 rounded-[3rem] animate-in fade-in duration-700 text-center space-y-4">
                                <Zap size={32} className="text-rose-500/40 mx-auto" />
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic leading-relaxed">
                                    Protocol Halt: Consultant offline on {getDayOfWeek(selectedDate)}s.<br/>Please select alternative cycle baseline.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-12 px-2 animate-in slide-in-from-right-8 duration-700">
                                <SlotGroup label="Meridian" slots={morningSlots} />
                                <SlotGroup label="Post-Meridian" slots={afternoonSlots} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-16 pt-12 border-t border-white/5 space-y-8">
                    <div className="flex items-center gap-4 px-2">
                        <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-600"><FileText size={16} /></div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Clinical Nuance Feed</label>
                    </div>
                    <textarea
                        value={symptoms}
                        onChange={e => setSymptoms(e.target.value)}
                        rows={3}
                        placeholder="Transmit preliminary symptomatic patterns for consultant analysis..."
                        className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] px-10 py-8 text-sm font-bold text-[var(--test-base)] italic focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all outline-none resize-none shadow-inner uppercase tracking-wider"
                    />
                </div>

                {selectedDate && selectedDoctor && !waitlistJoined && (
                    <div className="mt-12 p-10 bg-amber-500/5 border border-amber-500/20 rounded-[3.5rem] animate-in slide-in-from-bottom-8 duration-700 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity"><Bell size={64} /></div>
                        <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
                            <div className="flex items-center gap-8 text-center lg:text-left flex-1">
                                <div className="w-20 h-20 bg-amber-500 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-amber-500/30 group-hover:rotate-12 transition-transform duration-700">
                                    <Zap size={32} strokeWidth={2.5} />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-2xl font-black text-amber-600 uppercase tracking-tighter italic leading-none">Priority Protocol Active</h4>
                                    <p className="text-[10px] font-bold text-slate-500 italic uppercase tracking-[0.3em] leading-relaxed opacity-80">Join the neural waitlist. Decrypt earlier priority nodes automatically.</p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-5 w-full lg:w-auto">
                                <select value={waitlistTimePreference} onChange={e => setWaitlistTimePreference(e.target.value)} className="w-full sm:w-auto bg-white/10 border border-amber-500/20 rounded-2xl px-6 py-4 text-[10px] font-black text-amber-600 uppercase tracking-widest outline-none italic">
                                    <option value="ANY">Omni-Cycle</option>
                                    <option value="MORNING">Meridian</option>
                                    <option value="AFTERNOON">Post-Meridian</option>
                                </select>
                                <button onClick={handleJoinWaitlist} disabled={waitlistJoining} className="w-full sm:w-auto px-10 py-5 bg-amber-500 text-white rounded-[1.75rem] text-[10px] font-black uppercase tracking-[0.4em] hover:bg-amber-600 shadow-2xl shadow-amber-500/20 transition-all hover:scale-105 italic">
                                    {waitlistJoining ? 'Syncing...' : 'Engage Priority'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-16 flex justify-end relative z-10">
                    <button
                        disabled={!selectedDate || !selectedSlot || !selectedDoctor || isSubmitting}
                        onClick={async () => {
                            setIsSubmitting(true);
                            try {
                                const response = await fetch(`${API}/api/appointments/book`, {
                                    method: 'POST',
                                    headers: authedHeaders(true),
                                    body: JSON.stringify({ patientId: user.id, doctorId: selectedDoctor, date: selectedDate, timeSlot: selectedSlot, symptoms: symptoms || null })
                                });
                                const result = await response.json();
                                if (response.ok) { setBookingResult(result); setIsBooked(true); } else { alert(result.message || 'Registry sync error'); }
                            } finally { setIsSubmitting(false); }
                        }}
                        className={`px-16 py-6 rounded-[2.5rem] font-black text-[11px] uppercase tracking-[0.5em] transition-all shadow-2xl italic flex items-center gap-4 ${selectedDate && selectedSlot && !isSubmitting ? 'bg-primary text-white shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1' : 'bg-white/5 text-slate-800 opacity-20 cursor-not-allowed'}`}
                    >
                        {isSubmitting ? <><Activity size={18} className="animate-spin" /> Indexing Feed...</> : <><ShieldCheck size={18} /> Seal Reservation</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookAppointment;
