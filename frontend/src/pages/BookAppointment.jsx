import { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, 
    CheckCircle2, Users, ArrowRight, AlertCircle,
    Activity, ShieldCheck, Zap, MapPin, FileText,
    Stethoscope, CalendarDays
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';
// InsuranceScanner bundles tesseract.js (~4 MB) — lazy-loaded so it is only
// fetched when the user opens the scanner modal, not on initial page load.
const InsuranceScanner = lazy(() => import('../components/InsuranceScanner'));
import InsuranceForm from '../components/InsuranceForm';
import CheckoutForm from '../components/CheckoutForm';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Initialize Stripe outside component to avoid recreation
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;
if (!stripePublicKey) {
    console.error('Missing VITE_STRIPE_PUBLIC_KEY. Stripe checkout is disabled.');
}

const parseSlotTime = (slotLabel) => {
    if (!slotLabel) return null;
    try {
        const cleanLabel = slotLabel.split(/[–\-—]/)[0].trim().toUpperCase();
        const ampmMatch = cleanLabel.match(/(\d{1,2}):(\d{1,2})\s*(AM|PM)/i);
        if (ampmMatch) {
            let hours = parseInt(ampmMatch[1], 10);
            const minutes = parseInt(ampmMatch[2], 10);
            const ampm = ampmMatch[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
            return { hours, minutes };
        }
        const simpleMatch = cleanLabel.match(/(\d{1,2}):(\d{1,2})/);
        if (simpleMatch) {
            const hours = parseInt(simpleMatch[1], 10);
            const minutes = parseInt(simpleMatch[2], 10);
            return { hours, minutes };
        }
        return null;
    } catch {
        return null;
    }
};

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const parseAvailability = (av) => {
    if (!av) return null;
    try {
        return typeof av === 'string' ? JSON.parse(av) : av;
    } catch {
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
    } catch {
        return [];
    }
};

const isDayOpen = (dayAvail) => {
    if (!dayAvail) return false;
    if (Array.isArray(dayAvail)) {
        return dayAvail.length > 0;
    }
    return dayAvail.open === true;
};

const hasAnyAvailability = (avail) => {
    if (!avail) return false;
    return Object.keys(avail).some(day => {
        const dayAvail = avail[day];
        return isDayOpen(dayAvail);
    });
};

const getSlotsForDay = (dayAvail) => {
    if (!dayAvail) return [];
    if (Array.isArray(dayAvail)) {
        return dayAvail.map(slotStr => {
            let hour = 9;
            try {
                const parts = slotStr.split(':');
                let h = parseInt(parts[0], 10);
                if (slotStr.toLowerCase().includes('pm') && h !== 12) {
                    h += 12;
                } else if (slotStr.toLowerCase().includes('am') && h === 12) {
                    h = 0;
                }
                hour = h;
            } catch (e) {
                console.error('Failed to parse hour from slot:', slotStr, e);
            }
            return {
                label: slotStr,
                hour: hour
            };
        });
    }
    if (dayAvail.open) {
        return generateHourlySlots(dayAvail.from, dayAvail.to);
    }
    return [];
};

const BookAppointment = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    
    // UI State
    const [step, setStep] = useState(1);
    const [isBooked, setIsBooked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Data State
    const [doctors, setDoctors] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [specialtiesError, setSpecialtiesError] = useState(false);
    const [specialtiesLoaded, setSpecialtiesLoaded] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [symptoms, setSymptoms] = useState('');
    
    // Calendar & Slots
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [blockedDates, setBlockedDates] = useState(new Set());
    const [slotCounts, setSlotCounts] = useState({});
    const [bookingResult, setBookingResult] = useState(null);
    
    // Waitlist State
    const [waitlistJoining, setWaitlistJoining] = useState(false);
    const [waitlistJoined, setWaitlistJoined] = useState(false);
    const [waitlistTimePreference, setWaitlistTimePreference] = useState('ANY');
    
    // Stripe State
    const [clientSecret, setClientSecret] = useState('');
    const [stripeOptions, setStripeOptions] = useState(null);
    
    // Insurance integration
    const [insurance, setInsurance] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [scannedData, setScannedData] = useState(null);

    useEffect(() => {
        fetchInsurance();
    }, []);

    const fetchInsurance = async () => {
        try {
            const data = await apiClient.get('/api/insurance/my');
            if (data && data.length > 0 && !data.error) {
                // Get the most recently updated/verified insurance
                const sorted = data.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                setInsurance(sorted[0]);
            }
        } catch (err) {
            console.error('Error fetching insurance:', err);
        }
    };

    const handleScanComplete = (data) => {
        setScannedData(data);
        setShowScanner(false);
        setShowForm(true);
    };

    const handleInsuranceSuccess = () => {
        setShowForm(false);
        setScannedData(null);
        fetchInsurance();
    };

    // Persistence Logic
    useEffect(() => {
        const saved = localStorage.getItem('pendingBooking');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.doctorId) setSelectedDoctorId(data.doctorId);
                if (data.specialty) setSelectedSpecialty(data.specialty);
                if (data.date) setSelectedDate(data.date);
                if (data.slot) setSelectedSlot(data.slot);
                if (data.step) setStep(data.step);
                
                // Clear after loading
                localStorage.removeItem('pendingBooking');
            } catch {
                console.error('Failed to parse saved booking');
            }
        }
    }, []);

    useEffect(() => {
        if (location.state?.symptoms) {
            setSymptoms(location.state.symptoms);
        }
    }, [location.state]);

    const saveAndRedirect = (target) => {
        const state = {
            doctorId: selectedDoctorId,
            specialty: selectedSpecialty,
            date: selectedDate,
            slot: selectedSlot,
            step: 5
        };
        localStorage.setItem('pendingBooking', JSON.stringify(state));
        navigate(target, { state: { symptoms } });
    };

    useEffect(() => {
        const fetchDocs = async () => {
            const data = await apiClient.get('/api/doctors');
            if (Array.isArray(data) && !data.error) {
                const pruned = data.filter(d => d && typeof d === 'object' && d.id);
                setDoctors(pruned);
            }
        };
        const fetchSpecs = async () => {
            setSpecialtiesError(false);
            const data = await apiClient.get('/api/departments');
            if (Array.isArray(data) && !data.error) {
                setSpecialties(data.map(d => d.name));
                setSpecialtiesLoaded(true);
            } else {
                setSpecialties([]);
                setSpecialtiesError(true);
                setSpecialtiesLoaded(true);
            }
        };
        fetchDocs();
        fetchSpecs();
    }, []);

    useEffect(() => {
        if (!selectedDoctorId) return;
        
        const fetchBlocked = async () => {
            const data = await apiClient.get(`/api/doctors/${selectedDoctorId}/blocked-dates`);
            if (Array.isArray(data) && !data.error) {
                setBlockedDates(new Set(data.map(d => d.blocked_date.slice(0, 10))));
            }
        };
        fetchBlocked();
    }, [selectedDoctorId]);

    useEffect(() => {
        if (!selectedDoctorId || !selectedDate) return;
        
        const fetchSlots = async () => {
            const data = await apiClient.get(`/api/doctors/${selectedDoctorId}/slot-counts?date=${selectedDate}`);
            if (data && !data.error) setSlotCounts(data);
        };
        fetchSlots();
    }, [selectedDoctorId, selectedDate]);

    const handleJoinWaitlist = async () => {
        if (!selectedDoctorId || !selectedDate) return;
        setWaitlistJoining(true);
        try {
            const data = await apiClient.post('/api/appointments/waitlist/join', {
                doctorId: selectedDoctorId,
                preferredDate: selectedDate,
                timePreference: waitlistTimePreference,
                maxNoticeHours: 24,
                reason: symptoms || 'Patient requested earlier availability'
            });
            if (data && !data.error) setWaitlistJoined(true);
        } catch (err) {
            console.error('[Booking] Waitlist error:', err);
        } finally {
            setWaitlistJoining(false);
        }
    };

    const handleBook = async () => {
        if (!user || !user.id) {
            alert('Please sign in to book an appointment.');
            return;
        }
        setIsSubmitting(true);
        try {
            const data = await apiClient.post('/api/appointments/book', { 
                doctorId: selectedDoctorId, 
                date: selectedDate, 
                timeSlot: selectedSlot, 
                symptoms: symptoms || null 
            });
            // apiClient returns [] on network errors — treat arrays as failure
            if (data && !Array.isArray(data) && !data.error && data.appointmentId) {
                setBookingResult(data);
                
                if (!stripePromise) {
                    alert('Booking created, but payment is temporarily unavailable due to missing Stripe configuration. Please complete payment from your dashboard later.');
                    setIsBooked(true);
                    return;
                }

                try {
                    // Fetch Stripe client secret for this appointment
                    const intentData = await apiClient.post('/api/payments/create-intent', {
                        appointmentId: data.appointmentId
                    });
                    
                    if (intentData && intentData.clientSecret) {
                        setClientSecret(intentData.clientSecret);
                        setStripeOptions({
                            clientSecret: intentData.clientSecret,
                            appearance: { theme: 'stripe' }
                        });
                        setStep(6); // Transition to Payment Step
                    } else {
                        alert('Booking created, but failed to initialize payment. Please complete payment from your dashboard later.');
                        setIsBooked(true);
                    }
                } catch (paymentErr) {
                    console.error('[Booking] Payment intent initialization failed:', paymentErr);
                    alert('Booking created successfully, but payment setup failed. Please complete payment from your dashboard later.');
                    setIsBooked(true);
                }
            } else if (data && data.error) {
                const errMsg = data.detail 
                    ? `${data.message}: ${data.detail}` 
                    : (data.message || 'Unable to complete booking. Please try again.');
                alert(errMsg);
            } else {
                alert('Unable to complete booking. Please check your connection and try again.');
            }
        } catch (err) {
            console.error('[Booking] Connection error:', err);
            alert('A connection error occurred. Please check your network.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePaymentSuccess = () => {
        setIsBooked(true);
    };

    const selectedDoctor = doctors.find(d => String(d.id) === String(selectedDoctorId));
    const doctorAvail = parseAvailability(selectedDoctor?.availability);
    const capacity = selectedDoctor?.max_patients_per_slot || 15;

    const filteredDoctors = selectedSpecialty 
        ? doctors.filter(d => d.specialty?.trim().toLowerCase() === selectedSpecialty?.trim().toLowerCase())
        : doctors;

    // Helper: Step Progress
    const StepIndicator = () => (
        <div className="flex items-center justify-center gap-4 mb-12">
            {[1, 2, 3, 4, 5, 6].map(s => (
                <div key={s} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        step === s ? 'bg-primary text-white scale-110 shadow-lg' : 
                        step > s ? 'bg-success text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                        {step > s ? <CheckCircle2 size={16} /> : s}
                    </div>
                    {s < 6 && <div className={`w-8 md:w-16 h-0.5 mx-2 rounded-full ${step > s ? 'bg-success' : 'bg-slate-200'}`}></div>}
                </div>
            ))}
        </div>
    );

    // --- Renderers for Steps ---

    const renderStep1 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold mb-8 text-center">Which department do you need?</h2>
            {specialtiesLoaded && specialties.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white max-w-2xl mx-auto px-6">
                    <Users size={36} className="mx-auto text-slate-300 mb-4 animate-pulse" />
                    <p className="text-sm font-bold text-slate-500">
                        {specialtiesError ? 'Failed to load medical departments.' : 'No active departments available.'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        {specialtiesError ? 'Please check your connection and try again.' : 'Please check back later or contact hospital administration.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {specialties.map(spec => (
                        <button
                            key={spec}
                            onClick={() => { setSelectedSpecialty(spec); setStep(2); }}
                            className={`apple-card p-8 text-left hover:border-primary/50 border border-transparent group transition-all ${selectedSpecialty === spec ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        >
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                                <Stethoscope size={24} />
                            </div>
                            <h3 className="text-lg font-bold mb-1">{spec}</h3>
                            <p className="text-sm text-slate-500">View available consultants</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const renderStep2 = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => setStep(1)} className="text-slate-500 hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors">
                    <ChevronLeft size={16} /> Change Department
                </button>
                <h2 className="text-2xl font-semibold">Select a Doctor</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredDoctors.map(doc => (
                    <button
                        key={doc.id}
                        onClick={() => { setSelectedDoctorId(doc.id); setStep(3); }}
                        className={`apple-card p-6 flex items-center gap-6 text-left border border-transparent hover:border-primary/50 transition-all ${selectedDoctorId === doc.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    >
                        <img 
                            src={doc.image_url || `https://ui-avatars.com/api/?name=${doc.first_name}+${doc.last_name}&background=e8f2ff&color=0071e3`} 
                            className="w-20 h-20 rounded-2xl object-cover"
                            alt={doc.first_name}
                        />
                        <div>
                            <h3 className="text-lg font-bold">Dr. {doc.first_name} {doc.last_name}</h3>
                            <p className="text-sm text-primary font-medium">{doc.specialty}</p>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <MapPin size={12} /> {doc.location_room || 'Main Clinic'}
                            </p>
                        </div>
                    </button>
                ))}
                {filteredDoctors.length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white">
                        <Users size={36} className="mx-auto text-slate-300 mb-4 animate-pulse" />
                        <p className="text-sm font-bold text-slate-500">No active specialists available in this department.</p>
                        <p className="text-xs text-slate-400 mt-1">Please choose another department or check back later.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderStep3 = () => {
        if (!hasAnyAvailability(doctorAvail)) {
            return (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={() => setStep(2)} className="text-slate-500 hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors">
                            <ChevronLeft size={16} /> Choose Doctor
                        </button>
                        <h2 className="text-2xl font-semibold">Choose Date & Time</h2>
                    </div>
                    <div className="apple-card p-12 text-center border-dashed border-2 border-slate-100 bg-transparent text-slate-400">
                        <AlertCircle size={40} className="mx-auto mb-4 opacity-50 text-amber-500" />
                        <h3 className="text-lg font-bold text-slate-700 mb-2">Doctor Unavailable</h3>
                        <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto">This doctor has not configured their operating availability yet. Please choose another doctor.</p>
                    </div>
                </div>
            );
        }

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        
        const currentDayAvail = selectedDate ? doctorAvail?.[getDayOfWeek(selectedDate)] : null;
        const allSlots = getSlotsForDay(currentDayAvail);

        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setStep(2)} className="text-slate-500 hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors">
                        <ChevronLeft size={16} /> Choose Doctor
                    </button>
                    <h2 className="text-2xl font-semibold">Choose Date & Time</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Calendar Part */}
                    <div className="apple-card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <span className="font-bold text-lg">{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft size={20} /></button>
                                <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight size={20} /></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {days.map(d => <div key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(date => {
                                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                                const isPast = new Date(year, month, date) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                const closed = !isPast && !isDayOpen(doctorAvail?.[getDayOfWeek(dStr)]);
                                const isBlocked = !isPast && blockedDates.has(dStr);
                                const disabled = isPast || closed || isBlocked;
                                
                                return (
                                    <button
                                        key={date}
                                        disabled={disabled}
                                        onClick={() => setSelectedDate(dStr)}
                                        className={`h-10 md:h-12 w-full rounded-xl flex items-center justify-center text-sm font-medium transition-all ${
                                            selectedDate === dStr ? 'bg-primary text-white shadow-md' :
                                            disabled ? 'text-slate-200 cursor-not-allowed' : 'hover:bg-primary-light hover:text-primary'
                                        }`}
                                    >
                                        {date}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Slots Part */}
                    <div className="space-y-6">
                        {!selectedDate ? (
                            <div className="h-full flex flex-col items-center justify-center apple-card p-12 border-dashed border-2 border-slate-100 bg-transparent text-slate-400">
                                <CalendarDays size={40} className="mb-4 opacity-20" />
                                <p className="text-sm font-medium">Select a date to view available times</p>
                            </div>
                        ) : allSlots.length === 0 ? (
                            <div className="space-y-6">
                                <div className="apple-card p-8 bg-amber-500/5 border-amber-500/10 text-center">
                                    <Zap size={32} className="mx-auto mb-3 text-amber-500/50" />
                                    <p className="text-sm font-semibold text-amber-700">No slots available on this date.</p>
                                    <p className="text-xs text-amber-600/80 mt-1">Join our priority waitlist to get notified of cancellations.</p>
                                </div>
                                {!waitlistJoined ? (
                                    <div className="apple-card p-6 border-amber-200 bg-amber-50/30">
                                        <div className="flex flex-col gap-4">
                                            <select 
                                                value={waitlistTimePreference} 
                                                onChange={e => setWaitlistTimePreference(e.target.value)} 
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                                            >
                                                <option value="ANY">Any time of day</option>
                                                <option value="MORNING">Morning only</option>
                                                <option value="AFTERNOON">Afternoon only</option>
                                            </select>
                                            <button 
                                                onClick={handleJoinWaitlist} 
                                                disabled={waitlistJoining}
                                                className="w-full py-4 bg-amber-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-[0.98]"
                                            >
                                                {waitlistJoining ? 'Joining...' : 'Join Priority Waitlist'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="apple-card p-6 border-success/20 bg-success/5 text-center">
                                        <CheckCircle2 size={24} className="mx-auto mb-2 text-success" />
                                        <p className="text-sm font-bold text-success">You're on the waitlist!</p>
                                        <p className="text-xs text-success/70">We'll notify you as soon as a spot opens up.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                                    <Clock size={16} /> Available Times for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {allSlots.map(s => {
                                        const booked = slotCounts[s.label] || 0;
                                        const isFull = booked >= capacity;
                                        
                                        // Disable if today and slot start time is in the past
                                        let isPast = false;
                                        if (selectedDate) {
                                            const localToday = new Date();
                                            let selYear, selMonth, selDay;
                                            if (selectedDate.includes('-')) {
                                                const parts = selectedDate.split('T')[0].split('-');
                                                selYear = parseInt(parts[0], 10);
                                                selMonth = parseInt(parts[1], 10) - 1;
                                                selDay = parseInt(parts[2], 10);
                                            } else {
                                                const selD = new Date(selectedDate);
                                                selYear = selD.getFullYear();
                                                selMonth = selD.getMonth();
                                                selDay = selD.getDate();
                                            }

                                            const isToday = selYear === localToday.getFullYear() &&
                                                            selMonth === localToday.getMonth() &&
                                                            selDay === localToday.getDate();

                                            if (isToday) {
                                                const slotTime = parseSlotTime(s.label);
                                                if (slotTime) {
                                                    const currentMinutes = localToday.getHours() * 60 + localToday.getMinutes();
                                                    const slotMinutes = slotTime.hours * 60 + slotTime.minutes;
                                                    if (currentMinutes >= slotMinutes) {
                                                        isPast = true;
                                                    }
                                                } else if (localToday.getHours() >= s.hour) {
                                                    isPast = true;
                                                }
                                            }
                                        }

                                        const isDisabled = isFull || isPast;
                                        return (
                                            <button
                                                key={s.label}
                                                disabled={isDisabled}
                                                onClick={() => setSelectedSlot(s.label)}
                                                className={`p-4 rounded-2xl border transition-all text-center ${
                                                    selectedSlot === s.label ? 'bg-primary text-white border-primary shadow-lg scale-[1.02]' :
                                                    isDisabled ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' :
                                                    'bg-white border-slate-100 hover:border-primary/30 hover:bg-primary-light/30'
                                                }`}
                                            >
                                                <div className="text-sm font-bold">{s.label}</div>
                                                <div className={`text-[10px] mt-1 ${selectedSlot === s.label ? 'text-white/80' : 'text-slate-400'}`}>
                                                    {isFull ? 'Fully Booked' : isPast ? 'Time Passed' : `${capacity - booked} slots left`}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <button 
                                    disabled={!selectedSlot}
                                    onClick={() => setStep(4)}
                                    className="w-full btn-primary py-4 mt-8"
                                >
                                    Continue <ArrowRight size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderStep4 = () => (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => setStep(3)} className="text-slate-500 hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors">
                    <ChevronLeft size={16} /> Change Time
                </button>
                <h2 className="text-2xl font-semibold">Tell us more</h2>
            </div>
            <div className="apple-card p-8">
                <label className="form-label mb-4">What brings you in today?</label>
                <textarea
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    rows={5}
                    placeholder="Briefly describe your symptoms or reason for visit..."
                    className="input-field mb-8 text-lg"
                />
                <button 
                    onClick={() => setStep(5)}
                    className="w-full btn-primary py-4"
                >
                    Review Appointment <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );

    const renderStep5 = () => (
        <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => setStep(4)} className="text-slate-500 hover:text-primary flex items-center gap-2 text-sm font-medium transition-colors">
                    <ChevronLeft size={16} /> Edit Details
                </button>
                <h2 className="text-2xl font-semibold">Confirm Appointment</h2>
            </div>
            <div className="apple-card overflow-hidden">
                <div className="bg-primary-light p-8 flex items-center gap-6">
                    <img 
                        src={selectedDoctor?.image_url || `https://ui-avatars.com/api/?name=${selectedDoctor?.first_name}+${selectedDoctor?.last_name}&background=ffffff&color=0071e3`} 
                        className="w-20 h-20 rounded-2xl object-cover shadow-sm"
                        alt="Doctor"
                    />
                    <div>
                        <h3 className="text-xl font-bold">Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name}</h3>
                        <p className="text-primary font-medium">{selectedDoctor?.specialty}</p>
                    </div>
                </div>
                <div className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500"><CalendarIcon size={20} /></div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Date</p>
                            <p className="font-semibold">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500"><Clock size={20} /></div>
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Time</p>
                            <p className="font-semibold">{selectedSlot}</p>
                        </div>
                    </div>
                    {symptoms && (
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 mt-1"><FileText size={20} /></div>
                            <div>
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Reason for Visit</p>
                                <p className="text-sm text-slate-600">"{symptoms}"</p>
                            </div>
                        </div>
                    )}
                    <div className="pt-6 border-t border-slate-100">
                        {user ? (
                            <button 
                                disabled={isSubmitting}
                                onClick={handleBook}
                                className="w-full btn-primary py-4 text-lg"
                            >
                                {isSubmitting ? <Activity size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                                {isSubmitting ? 'Confirming...' : 'Proceed to Payment'}
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
                                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                        You are booking as a guest. Please sign in or create an account to secure your appointment and sync it with your medical history.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => saveAndRedirect('/login')}
                                        className="btn-primary py-4 text-sm"
                                    >
                                        Sign In
                                    </button>
                                    <button 
                                        onClick={() => saveAndRedirect('/register')}
                                        className="bg-white border-2 border-primary/20 text-primary hover:bg-primary/5 font-bold py-4 rounded-2xl text-sm transition-all"
                                    >
                                        Register
                                    </button>
                                </div>
                            </div>
                        )}
                        <p className="text-center text-[10px] text-slate-400 mt-4 px-4 leading-relaxed">
                            {user 
                                ? "By confirming, you agree to our clinical guidelines and cancellation policy." 
                                : "Your selection will be saved during authentication."}
                        </p>
                    </div>
                {waitlistJoined && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="text-green-600" size={20} />
                            <div>
                                <h4 className="font-semibold text-green-800">Added to Waitlist!</h4>
                                <p className="text-sm text-green-700">
                                    We'll notify you if a slot becomes available for this date.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Insurance Verification Section */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck size={20} className="text-emerald-600" />
                            Insurance Verification
                        </h4>
                        {!insurance && (
                            <button 
                                onClick={() => setShowScanner(true)}
                                className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-1"
                            >
                                <Users size={14} />
                                Smart Scan Card
                            </button>
                        )}
                    </div>

                    {insurance ? (
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${
                            insurance.status === 'VERIFIED' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                    insurance.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{insurance.provider_name}</p>
                                    <p className="text-xs text-gray-500">ID: {insurance.member_id} • Status: <span className="font-bold">{insurance.status}</span></p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowForm(true)}
                                className="text-xs font-bold text-emerald-600 hover:underline"
                            >
                                Change
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center">
                            <p className="text-sm text-gray-500 mb-3">No insurance on file. Add one for faster check-in.</p>
                            <div className="flex justify-center gap-4">
                                <button 
                                    onClick={() => setShowScanner(true)}
                                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors"
                                >
                                    <Activity size={16} className="text-emerald-500" />
                                    Scan Card
                                </button>
                                <button 
                                    onClick={() => setShowForm(true)}
                                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:underline"
                                >
                                    Manual Entry
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {showScanner && (
                        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><div className="text-white font-semibold">Loading Scanner…</div></div>}>
                            <InsuranceScanner 
                                onScanComplete={handleScanComplete} 
                                onClose={() => setShowScanner(false)} 
                            />
                        </Suspense>
                    )}

                    {showForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xl w-full max-w-2xl"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold dark:text-white">Insurance Details</h2>
                                    <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                                </div>
                                <InsuranceForm initialData={scannedData} onSuccess={handleInsuranceSuccess} />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                </div>
            </div>
        </div>
    );

    const renderStep6 = () => (
        <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold mb-2">Complete Payment</h2>
                <p className="text-slate-500 text-sm">You're booking a consultation with Dr. {selectedDoctor?.first_name}</p>
            </div>
            
            {clientSecret && stripeOptions && (
                <Elements stripe={stripePromise} options={stripeOptions}>
                    <CheckoutForm 
                        amount={selectedDoctor?.consultation_fee || 500} 
                        onPaymentSuccess={handlePaymentSuccess} 
                    />
                </Elements>
            )}
            
            {!clientSecret && (
                <div className="text-center p-10">
                    <Activity size={32} className="animate-spin text-primary mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Initializing secure payment gateway...</p>
                </div>
            )}
        </div>
    );

    if (isBooked) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 animate-in zoom-in-95 duration-500">
                <div className="apple-card p-12 text-center">
                    <div className="w-20 h-20 bg-success text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-success/20">
                        <CheckCircle2 size={40} />
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Appointment Confirmed</h2>
                    <p className="text-slate-500 mb-10 max-w-sm mx-auto">Your visit with Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name} is successfully scheduled.</p>
                    
                    <div className="bg-slate-50 rounded-[2rem] p-8 mb-10 grid grid-cols-2 gap-4">
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Queue ID</p>
                            <p className="text-xl font-bold text-primary">#{bookingResult?.queueNumber || '1'}</p>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Est. Time</p>
                            <p className="text-xl font-bold text-primary">{selectedSlot?.split('–')[0]}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={() => navigate('/queue')} className="flex-1 btn-primary py-4">
                            Track Status <ArrowRight size={18} />
                        </button>
                        <button onClick={() => navigate('/patient-dashboard')} className="flex-1 btn-secondary py-4">
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="section-container">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-3 tracking-tight">Book an Appointment</h1>
                <p className="text-slate-500">Follow the simple steps below to schedule your visit.</p>
            </div>

            <StepIndicator />

            {/* Content Area */}
            <div className="min-h-[400px]">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
                {step === 6 && renderStep6()}
            </div>
        </div>
    );
};

export default BookAppointment;
