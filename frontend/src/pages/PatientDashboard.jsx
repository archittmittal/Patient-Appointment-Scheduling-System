import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, User, ChevronRight, Bell, X, ListPlus, Home, Wifi, FileText, Pill, Activity, Zap, ClipboardCheck, AlarmClock, MessageSquare, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const STATUS_STYLES = {
    CONFIRMED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    PENDING:   'bg-amber-50 text-amber-700 border border-amber-100',
    COMPLETED: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    CANCELLED: 'bg-rose-50 text-rose-700 border border-rose-100',
};

const StatCard = ({ title, value, icon: Icon, sub, onClick }) => (
    <div 
        onClick={onClick}
        className={`glass-card p-6 rounded-[2rem] flex items-start justify-between group transition-all duration-300 ${onClick ? 'cursor-pointer hover:translate-y-[-4px] active:scale-95' : ''}`}
    >
        <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tight">{value}</h3>
            {sub && <p className="text-[11px] text-slate-400 font-medium mt-2">{sub}</p>}
        </div>
        {Icon && (
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shadow-sm shadow-indigo-100">
                <Icon size={24} strokeWidth={2.5} />
            </div>
        )}
    </div>
);

const AppointmentCard = ({ apt, navigate, onViewReport }) => {
    const doctor = `Dr. ${apt.doc_first} ${apt.doc_last}`;
    const statusLabel = apt.status.charAt(0).toUpperCase() + apt.status.slice(1).toLowerCase();
    const dateStr = new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Check if appointment is today
    const today = new Date().toISOString().split('T')[0];
    const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
    const isToday = today === aptDate;
    const canVirtualCheckin = isToday && ['CONFIRMED', 'PENDING', 'WAITING', 'IN_PROGRESS'].includes((apt.status || '').toUpperCase());

    return (
        <div className="glass-card p-6 rounded-[1.5rem] hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 group">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden ring-4 ring-slate-50 group-hover:ring-indigo-50 transition-all duration-300">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(doctor)}&background=4338ca&color=fff&bold=true`} alt={doctor} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-base leading-tight">Dr. {apt.doc_first} {apt.doc_last}</h4>
                        <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest mt-0.5">{apt.specialty}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider ${STATUS_STYLES[(apt.status || '').toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>
                    {statusLabel}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2 text-gray-600">
                    <CalendarIcon size={14} className="text-primary flex-shrink-0" />
                    <span className="text-xs">{dateStr}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={14} className="text-primary flex-shrink-0" />
                    <span className="text-xs">{apt.time_slot}</span>
                </div>
                {apt.location_room && (
                    <div className="flex items-center gap-2 text-gray-600 col-span-2">
                        <MapPin size={14} className="text-primary flex-shrink-0" />
                        <span className="text-xs truncate">{apt.location_room}</span>
                    </div>
                )}
            </div>
            {/* Issue #39: Virtual Check-in Button */}
            {canVirtualCheckin && (
                <button
                    onClick={() => navigate(`/virtual-waiting/${apt.id}`)}
                    className="w-full mt-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 hover:shadow-md hover:shadow-emerald-500/20 transition-all"
                >
                    <Wifi size={14} />
                    Virtual Check-in
                </button>
            )}
            {/* View Report Button */}
            {(apt.status || '').toUpperCase() === 'COMPLETED' && (apt.diagnosis || apt.prescription || apt.notes) && (
                <button
                    onClick={() => onViewReport(apt)}
                    className="w-full mt-4 py-2.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                >
                    <FileText size={14} />
                    View Report & Prescription
                </button>
            )}
        </div>
    );
};

const PatientDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [upcoming, setUpcoming] = useState([]);
    const [past, setPast] = useState([]);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [isLoading, setIsLoading] = useState(true);
    
    // Issue #41: Waitlist state
    const [waitlist, setWaitlist] = useState([]);
    const [offers, setOffers] = useState([]);
    const [processingOffer, setProcessingOffer] = useState(null);
    const [selectedReportApt, setSelectedReportApt] = useState(null);
    const [statModal, setStatModal] = useState(null); // 'doctors' | 'completed'
    
    // Smart Actions state
    const [pendingFeedback, setPendingFeedback] = useState([]);
    const [expressEligible, setExpressEligible] = useState([]);
    const [prepOverview, setPrepOverview] = useState([]);

    useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const [upRes, pastRes, waitlistRes, offersRes, feedbackRes, expressRes, prepRes] = await Promise.all([
                    fetch(`${API}/api/patients/${user.id}/appointments?type=upcoming`),
                    fetch(`${API}/api/patients/${user.id}/appointments?type=past`),
                    fetch(`${API}/api/appointments/waitlist/my`, { headers: authedHeaders() }),
                    fetch(`${API}/api/appointments/waitlist/offers`, { headers: authedHeaders() }),
                    fetch(`${API}/api/feedback/pending`, { headers: authedHeaders() }),
                    fetch(`${API}/api/express-checkin/today`, { headers: authedHeaders() }),
                    fetch(`${API}/api/prep/overview`, { headers: authedHeaders() }),
                ]);
                const [upData, pastData] = await Promise.all([upRes.json(), pastRes.json()]);
                setUpcoming(Array.isArray(upData) ? upData : []);
                setPast(Array.isArray(pastData) ? pastData : []);
                
                // Issue #41: Set waitlist data
                if (waitlistRes.ok) {
                    const waitlistData = await waitlistRes.json();
                    setWaitlist(Array.isArray(waitlistData) ? waitlistData : []);
                }
                if (offersRes.ok) {
                    const offersData = await offersRes.json();
                    setOffers(Array.isArray(offersData) ? offersData : []);
                }

                // Phase 2: Set Smart Actions data
                if (feedbackRes.ok) {
                    const data = await feedbackRes.json();
                    setPendingFeedback(Array.isArray(data) ? data : []);
                }
                if (expressRes.ok) {
                    const data = await expressRes.json();
                    setExpressEligible(Array.isArray(data) ? data : []);
                }
                if (prepRes.ok) {
                    const data = await prepRes.json();
                    setPrepOverview(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Dashboard error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user?.id]);

    // Issue #41: Accept slot offer
    const handleAcceptOffer = async (offerId) => {
        setProcessingOffer(offerId);
        try {
            const res = await fetch(`${API}/api/appointments/waitlist/offers/${offerId}/accept`, {
                method: 'POST',
                headers: authedHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setOffers(prev => prev.filter(o => o.id !== offerId));
                // Refresh appointments
                const upRes = await fetch(`${API}/api/patients/${user.id}/appointments?type=upcoming`);
                const upData = await upRes.json();
                setUpcoming(Array.isArray(upData) ? upData : []);
            }
        } catch (err) {
            console.error('Accept offer error:', err);
        } finally {
            setProcessingOffer(null);
        }
    };

    // Issue #41: Decline slot offer
    const handleDeclineOffer = async (offerId) => {
        setProcessingOffer(offerId);
        try {
            await fetch(`${API}/api/appointments/waitlist/offers/${offerId}/decline`, {
                method: 'POST',
                headers: authedHeaders()
            });
            setOffers(prev => prev.filter(o => o.id !== offerId));
        } catch (err) {
            console.error('Decline offer error:', err);
        } finally {
            setProcessingOffer(null);
        }
    };

    // Issue #41: Leave waitlist
    const handleLeaveWaitlist = async (waitlistId) => {
        try {
            await fetch(`${API}/api/appointments/waitlist/${waitlistId}`, {
                method: 'DELETE',
                headers: authedHeaders()
            });
            setWaitlist(prev => prev.filter(w => w.id !== waitlistId));
        } catch (err) {
            console.error('Leave waitlist error:', err);
        }
    };

    // Real derived stats
    const completedCount = past.filter(a => (a.status || '').toUpperCase() === 'COMPLETED').length;
    const uniqueDoctors = new Set([...upcoming, ...past].map(a => `${a.doc_first} ${a.doc_last}`)).size;
    const nextApt = upcoming[0];
    const latestFollowUp = past.find(a => a.follow_up_date)?.follow_up_date;
    
    const nextAptLabel = nextApt
        ? new Date(nextApt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : (latestFollowUp ? new Date(latestFollowUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
    
    const nextAptSub = nextApt 
        ? nextApt.time_slot 
        : (latestFollowUp ? 'Doctor recommended' : 'no upcoming');

    const displayed = activeTab === 'upcoming' ? upcoming : past;

    // Smart Actions Computation
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // Nudge: Running Late
    const todayApt = upcoming.find(apt => {
        const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
        return aptDate === todayStr && !['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(apt.status?.toUpperCase() || '');
    });

    let runningLateApt = null;
    if (todayApt) {
        const aptTimeSlot = todayApt.time_slot || todayApt.appointment_time;
        if (aptTimeSlot) {
            const timeParts = aptTimeSlot.split(':');
            let h = parseInt(timeParts[0]);
            let m = parseInt(timeParts[1]);
            // Format check for AM/PM in case time_slot uses 12h, but normally db is 24h or string.
            if (aptTimeSlot.toUpperCase().includes('PM') && h < 12) h += 12;
            if (aptTimeSlot.toUpperCase().includes('AM') && h === 12) h = 0;
            
            const aptTime = new Date();
            aptTime.setHours(h, m, 0, 0);

            const timeDiffMins = (aptTime - now) / 60000;
            if (timeDiffMins <= 60 && timeDiffMins >= -60) {
                runningLateApt = todayApt;
            }
        }
    }

    // Nudge: Express Check-in
    const expressCard = expressEligible.length > 0 ? expressEligible[0] : null;

    // Nudge: Prep Checklist
    const pendingPrepApt = prepOverview.find(prep => {
        if (!prep.appointment?.appointment_date) return false;
        const aptDate = new Date(prep.appointment.appointment_date);
        const diffHours = (aptDate - now) / 3600000;
        const requiredDone = prep.prepProgress?.requiredCompleted || 0;
        const requiredTotal = prep.prepProgress?.requiredTotal || 0;
        // Within 48 hours and not completed
        return diffHours >= -24 && diffHours <= 48 && requiredDone < requiredTotal;
    });

    // Nudge: Feedback
    const feedbackCard = pendingFeedback.length > 0 ? pendingFeedback[0] : null;

    const hasSmartActions = runningLateApt || expressCard || pendingPrepApt || feedbackCard;

    if (isLoading) {
        return <div className="p-10 text-center text-gray-500 font-medium animate-pulse">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div className="flex justify-between items-center bg-white/40 p-6 rounded-[2rem] border border-white/40 backdrop-blur-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back, <span className="text-indigo-600">{user?.first_name}</span>!</h1>
                    <p className="text-slate-500 font-medium mt-1">Your wellness journey at a glance.</p>
                </div>
                <button
                    onClick={() => navigate('/book')}
                    className="btn-primary flex items-center gap-2 group"
                >
                    <ListPlus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                    Book Appointment
                </button>
            </div>

            {/* Real stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Upcoming" 
                    value={upcoming.length} 
                    icon={CalendarIcon} 
                    sub="confirmed & scheduled" 
                    onClick={() => setActiveTab('upcoming')}
                />
                <StatCard 
                    title="Completed Visits" 
                    value={completedCount} 
                    icon={CheckCircle2} 
                    sub="click to view history" 
                    onClick={() => setStatModal('completed')}
                />
                <StatCard 
                    title="Doctors Seen" 
                    value={uniqueDoctors} 
                    icon={User} 
                    sub="click to view doctors" 
                    onClick={() => setStatModal('doctors')}
                />
                <StatCard 
                    title="Next Visit" 
                    value={nextAptLabel} 
                    icon={CalendarIcon} 
                    sub={nextAptSub} 
                />
            </div>

            {/* Smart Actions Panel */}
            {hasSmartActions && (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={18} className="text-amber-500" />
                        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Recommended Actions</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {runningLateApt && (
                            <div className="bg-gradient-to-br from-rose-50 to-red-50 p-5 rounded-2xl border border-rose-100 hover:shadow-lg transition-all group cursor-pointer" onClick={() => navigate(`/late-arrival?appointment=${runningLateApt.id}`)}>
                                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl w-fit mb-4">
                                    <AlarmClock size={20} />
                                </div>
                                <h3 className="font-bold text-rose-900 mb-1">Running Late?</h3>
                                <p className="text-xs text-rose-600 mb-3">You have an appointment soon. Let us know if you'll be delayed.</p>
                                <span className="text-xs font-bold text-rose-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Get Options <ArrowRight size={14} /></span>
                            </div>
                        )}
                        {expressCard && (
                            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-5 rounded-2xl border border-amber-100 hover:shadow-lg transition-all group cursor-pointer" onClick={() => navigate('/express-checkin')}>
                                <div className="p-3 bg-amber-100 text-amber-600 rounded-xl w-fit mb-4">
                                    <Zap size={20} />
                                </div>
                                <h3 className="font-bold text-amber-900 mb-1">Express Check-in</h3>
                                <p className="text-xs text-amber-600 mb-3">Skip the line for your appointment with {expressCard.doctor}.</p>
                                <span className="text-xs font-bold text-amber-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Check in now <ArrowRight size={14} /></span>
                            </div>
                        )}
                        {pendingPrepApt && (
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl border border-indigo-100 hover:shadow-lg transition-all group cursor-pointer" onClick={() => navigate(`/prep-checklist/${pendingPrepApt.appointment.id}`)}>
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl w-fit mb-4">
                                    <ClipboardCheck size={20} />
                                </div>
                                <h3 className="font-bold text-indigo-900 mb-1">Prep Checklist</h3>
                                <p className="text-xs text-indigo-600 mb-3">You have pending items for your upcoming appointment.</p>
                                <span className="text-xs font-bold text-indigo-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Complete prep <ArrowRight size={14} /></span>
                            </div>
                        )}
                        {feedbackCard && (
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100 hover:shadow-lg transition-all group cursor-pointer" onClick={() => navigate('/feedback')}>
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl w-fit mb-4">
                                    <MessageSquare size={20} />
                                </div>
                                <h3 className="font-bold text-emerald-900 mb-1">Rate Your Visit</h3>
                                <p className="text-xs text-emerald-600 mb-3">How was your visit with {feedbackCard.doctor_name}?</p>
                                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">Leave feedback <ArrowRight size={14} /></span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main appointments panel */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-4 border-b border-slate-100 mb-6">
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all duration-300 ${activeTab === 'upcoming' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Upcoming ({upcoming.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`pb-4 px-2 text-sm font-bold border-b-2 transition-all duration-300 ${activeTab === 'past' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Past Visits ({past.length})
                        </button>
                    </div>

                    {/* Appointment cards */}
                    {displayed.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-4">
                            {displayed.map((apt) => (
                                <AppointmentCard key={apt.id} apt={apt} navigate={navigate} onViewReport={setSelectedReportApt} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                                {activeTab === 'upcoming'
                                    ? <CalendarIcon size={28} className="text-gray-400" />
                                    : <CheckCircle2 size={28} className="text-gray-400" />
                                }
                            </div>
                            <p className="text-gray-500 font-medium">
                                {activeTab === 'upcoming' ? 'No upcoming appointments.' : 'No past visits yet.'}
                            </p>
                            {activeTab === 'upcoming' && (
                                <button onClick={() => navigate('/book')} className="mt-4 text-primary text-sm font-medium hover:underline">
                                    Book your first appointment →
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Medical history sidebar — real past appointments */}
                <div className="space-y-4">
                    {/* Issue #41: Slot Offers Alert */}
                    {offers.length > 0 && (
                        <div className="bg-emerald-50/50 rounded-3xl border border-emerald-100 p-6 animate-pulse-slow">
                            <div className="flex items-center gap-2 mb-4">
                                <Bell className="text-emerald-600" size={20} strokeWidth={2.5} />
                                <h3 className="font-black text-emerald-900 uppercase tracking-wider text-sm">Slot Available!</h3>
                            </div>
                            {offers.map(offer => (
                                <div key={offer.id} className="bg-white rounded-xl p-3 mb-2 last:mb-0 border border-green-100">
                                    <p className="text-sm font-semibold text-gray-900">
                                        Dr. {offer.doctor_first_name} {offer.doctor_last_name}
                                    </p>
                                    <p className="text-xs text-gray-500">{offer.specialization}</p>
                                    <p className="text-sm text-gray-700 mt-1">
                                        {new Date(offer.offered_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {offer.offered_time?.slice(0, 5)}
                                    </p>
                                    <p className="text-xs text-orange-600 font-medium mt-1">
                                        Expires in {offer.minutes_remaining} mins
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => handleAcceptOffer(offer.id)}
                                            disabled={processingOffer === offer.id}
                                            className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {processingOffer === offer.id ? '...' : 'Accept'}
                                        </button>
                                        <button
                                            onClick={() => handleDeclineOffer(offer.id)}
                                            disabled={processingOffer === offer.id}
                                            className="flex-1 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Issue #41: Active Waitlists */}
                    {waitlist.length > 0 && (
                        <div className="glass-card rounded-[2rem] p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <ListPlus size={18} strokeWidth={2.5} />
                                </div>
                                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">My Waitlists</h3>
                            </div>
                            {waitlist.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            Dr. {entry.doctor_first_name} {entry.doctor_last_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(entry.preferred_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • Position #{entry.queue_position}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleLeaveWaitlist(entry.id)}
                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Leave waitlist"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-2">
                         <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                            <Activity size={18} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent History</h2>
                    </div>
                    <div className="glass-card rounded-[2rem] p-8">
                        {past.length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">No visit history yet.</p>
                        ) : (
                            <div className="relative pl-6 border-l-2 border-primary/20 space-y-6">
                                {past.slice(0, 5).map((apt, idx) => (
                                    <div key={apt.id} className="relative">
                                        <span className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 bg-white ${idx === 0 ? 'border-primary' : 'border-gray-300'}`}></span>
                                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
                                            {new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <h4 className="text-sm font-semibold text-gray-900 mt-0.5">
                                            Dr. {apt.doc_first} {apt.doc_last}
                                        </h4>
                                        <p className="text-xs text-gray-500">{apt.specialty}</p>
                                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[(apt.status || '').toUpperCase()] || 'bg-gray-100 text-gray-600'}`}>
                                            {(apt.status || 'pending').toLowerCase()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {past.length > 0 && (
                            <button
                                onClick={() => setActiveTab('past')}
                                className="w-full mt-6 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                            >
                                View all history <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Report/Prescription Modal */}
            {selectedReportApt && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="glass-modal rounded-[2.5rem] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Consultation Report</h3>
                                <p className="text-sm text-slate-500 font-medium mt-1">
                                    Dr. {selectedReportApt.doc_first} {selectedReportApt.doc_last} • {new Date(selectedReportApt.appointment_date).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedReportApt(null)}
                                className="p-3 text-slate-400 hover:text-slate-900 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {selectedReportApt.diagnosis && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
                                        <Activity size={16} className="text-primary" /> Diagnosis
                                    </h4>
                                    <p className="text-gray-700 bg-gray-50 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">
                                        {selectedReportApt.diagnosis}
                                    </p>
                                </div>
                            )}

                            {selectedReportApt.prescription && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
                                        <Pill size={16} className="text-primary" /> Prescription
                                    </h4>
                                    <p className="text-gray-700 bg-blue-50/50 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border border-blue-100">
                                        {selectedReportApt.prescription}
                                    </p>
                                </div>
                            )}

                            {selectedReportApt.notes && (
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
                                        <FileText size={16} className="text-primary" /> Doctor's Notes
                                    </h4>
                                    <p className="text-gray-700 bg-gray-50 p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">
                                        {selectedReportApt.notes}
                                    </p>
                                </div>
                            )}

                            {selectedReportApt.follow_up_date && (
                                <div className="flex items-center gap-3 bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-100">
                                    <CalendarIcon size={20} className="text-amber-500" />
                                    <div>
                                        <p className="text-sm font-medium">Follow-up Recommended</p>
                                        <p className="text-xs text-amber-700">Please schedule your next visit on or around {new Date(selectedReportApt.follow_up_date).toLocaleDateString()}</p>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/book')}
                                        className="ml-auto px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg transition-colors"
                                    >
                                        Book Now
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setSelectedReportApt(null)}
                                className="btn-secondary px-8 font-bold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stat Details Modal */}
            {statModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/50">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                                {statModal === 'doctors' ? 'My Doctors' : 'Visit Registry'}
                            </h3>
                            <button
                                onClick={() => setStatModal(null)}
                                className="p-3 text-slate-400 hover:text-slate-900 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            {statModal === 'doctors' ? (
                                <div className="space-y-8">
                                    {Array.from(new Set([...upcoming, ...past].map(a => a.doctor_id))).map(docId => {
                                        const apts = [...upcoming, ...past].filter(a => a.doctor_id === docId);
                                        const doc = apts[0];
                                        return (
                                            <div key={docId} className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-200">
                                                        {(doc.doc_first || '?')[0]}{(doc.doc_last || '?')[0]}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 text-xl tracking-tight">Dr. {doc.doc_first} {doc.doc_last}</h4>
                                                        <p className="text-sm text-indigo-500 font-bold uppercase tracking-widest">{doc.specialty}</p>
                                                    </div>
                                                </div>
                                                <div className="grid gap-3">
                                                    {apts.map(apt => (
                                                        <div key={apt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{new Date(apt.appointment_date).toLocaleDateString()}</p>
                                                                <p className="text-sm font-bold text-slate-800">{apt.time_slot} • <span className={`uppercase text-[11px] font-black ${(apt.status || '').toUpperCase() === 'COMPLETED' ? 'text-indigo-600' : 'text-emerald-600'}`}>{apt.status || 'Pending'}</span></p>
                                                            </div>
                                                            {apt.status === 'COMPLETED' && (
                                                                <button 
                                                                    onClick={() => {
                                                                        setSelectedReportApt(apt);
                                                                        setStatModal(null);
                                                                    }}
                                                                    className="px-4 py-2 bg-white text-[11px] font-bold text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                                >
                                                                    Summary
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {past.filter(a => a.status === 'COMPLETED').map(apt => (
                                        <div key={apt.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between hover:shadow-2xl hover:shadow-indigo-500/5 transition-all">
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-600 mb-2 uppercase tracking-widest">{new Date(apt.appointment_date).toLocaleDateString()}</p>
                                                <h4 className="text-lg font-black text-slate-900 tracking-tight">Dr. {apt.doc_first} {apt.doc_last}</h4>
                                                <p className="text-sm text-slate-500 font-medium">{apt.symptoms || 'General Checkup'}</p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setSelectedReportApt(apt);
                                                    setStatModal(null);
                                                }}
                                                className="btn-primary py-2 px-5 text-xs font-bold"
                                            >
                                                Clinical Summary
                                            </button>
                                        </div>
                                    ))}
                                    {past.filter(a => a.status === 'COMPLETED').length === 0 && (
                                        <p className="text-center py-12 text-slate-400 font-medium italic">No completed records found yet.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboard;
