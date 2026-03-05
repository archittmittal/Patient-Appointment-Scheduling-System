/**
 * Issue #49: Batch Appointments Page
 * Beautiful UI for patients to view and book batch appointments
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Layers, Calendar, Clock, Users, ChevronRight, Search,
    Syringe, Stethoscope, ClipboardCheck, Flask, Pill,
    User, MapPin, CheckCircle2, AlertCircle, Sparkles,
    ArrowRight, Filter, X, Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

// Batch type icons and colors
const BATCH_TYPE_CONFIG = {
    VACCINATION: { icon: Syringe, color: 'emerald', label: 'Vaccination' },
    ROUTINE_CHECKUP: { icon: Stethoscope, color: 'blue', label: 'Check-up' },
    FOLLOWUP: { icon: ClipboardCheck, color: 'violet', label: 'Follow-up' },
    LAB_REVIEW: { icon: Flask, color: 'amber', label: 'Lab Review' },
    PRESCRIPTION_REFILL: { icon: Pill, color: 'pink', label: 'Rx Refill' }
};

// Color classes mapping
const getColorClasses = (color) => {
    const colorMap = {
        emerald: {
            bg: 'bg-emerald-50',
            bgDark: 'bg-emerald-100',
            text: 'text-emerald-600',
            border: 'border-emerald-200',
            gradient: 'from-emerald-400 to-green-500',
            shadow: 'shadow-emerald-500/30'
        },
        blue: {
            bg: 'bg-blue-50',
            bgDark: 'bg-blue-100',
            text: 'text-blue-600',
            border: 'border-blue-200',
            gradient: 'from-blue-400 to-cyan-500',
            shadow: 'shadow-blue-500/30'
        },
        violet: {
            bg: 'bg-violet-50',
            bgDark: 'bg-violet-100',
            text: 'text-violet-600',
            border: 'border-violet-200',
            gradient: 'from-violet-400 to-purple-500',
            shadow: 'shadow-violet-500/30'
        },
        amber: {
            bg: 'bg-amber-50',
            bgDark: 'bg-amber-100',
            text: 'text-amber-600',
            border: 'border-amber-200',
            gradient: 'from-amber-400 to-yellow-500',
            shadow: 'shadow-amber-500/30'
        },
        pink: {
            bg: 'bg-pink-50',
            bgDark: 'bg-pink-100',
            text: 'text-pink-600',
            border: 'border-pink-200',
            gradient: 'from-pink-400 to-rose-500',
            shadow: 'shadow-pink-500/30'
        }
    };
    return colorMap[color] || colorMap.blue;
};

// Batch Type Card
const BatchTypeCard = ({ type, isSelected, onClick }) => {
    const config = BATCH_TYPE_CONFIG[type.id] || BATCH_TYPE_CONFIG.ROUTINE_CHECKUP;
    const colors = getColorClasses(config.color);
    const Icon = config.icon;

    return (
        <button
            onClick={() => onClick(type.id)}
            className={`p-4 rounded-2xl border-2 transition-all duration-200 text-left w-full ${
                isSelected 
                    ? `${colors.border} ${colors.bg} scale-[1.02]`
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
            }`}
        >
            <div className={`w-10 h-10 rounded-xl ${colors.bgDark} flex items-center justify-center mb-3`}>
                <Icon className={colors.text} size={20} />
            </div>
            <h4 className="font-semibold text-gray-900 text-sm">{type.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <Users size={12} />
                <span>Up to {type.maxBatchSize} patients</span>
            </div>
        </button>
    );
};

// Batch Slot Card
const BatchSlotCard = ({ slot, onBook, isBooking }) => {
    const config = BATCH_TYPE_CONFIG[slot.batch_type] || BATCH_TYPE_CONFIG.ROUTINE_CHECKUP;
    const colors = getColorClasses(config.color);
    const Icon = config.icon;
    const available = slot.max_capacity - (slot.current_count || slot.booked_count || 0);
    const isFull = available <= 0;

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    return (
        <div className={`bg-white rounded-2xl border ${isFull ? 'border-gray-200 opacity-60' : 'border-gray-100'} shadow-sm overflow-hidden hover:shadow-md transition-shadow`}>
            <div className={`h-2 bg-gradient-to-r ${colors.gradient}`} />
            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${colors.bgDark}`}>
                            <Icon className={colors.text} size={20} />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900">{config.label}</h4>
                            <p className="text-sm text-gray-500">{slot.doctor_name}</p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isFull 
                            ? 'bg-gray-100 text-gray-500' 
                            : available <= 2 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-emerald-100 text-emerald-600'
                    }`}>
                        {isFull ? 'Full' : `${available} spots`}
                    </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-primary" />
                        <span>{formatDate(slot.slot_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-primary" />
                        <span>{formatTime(slot.start_time)}</span>
                    </div>
                </div>

                {/* Capacity bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Capacity</span>
                        <span>{slot.current_count || slot.booked_count || 0}/{slot.max_capacity}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                            style={{ width: `${((slot.current_count || slot.booked_count || 0) / slot.max_capacity) * 100}%` }}
                        />
                    </div>
                </div>

                <button
                    onClick={() => onBook(slot.id)}
                    disabled={isFull || isBooking}
                    className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        isFull 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : `bg-gradient-to-r ${colors.gradient} text-white hover:shadow-lg ${colors.shadow}`
                    }`}
                >
                    {isFull ? 'No Spots Available' : (
                        <>
                            <Plus size={18} />
                            Join Batch
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// My Batch Appointments Card
const MyBatchCard = ({ appointment }) => {
    const config = BATCH_TYPE_CONFIG[appointment.batch_type] || BATCH_TYPE_CONFIG.ROUTINE_CHECKUP;
    const colors = getColorClasses(config.color);
    const Icon = config.icon;

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
        });
    };

    const formatTime = (timeStr) => {
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    return (
        <div className={`${colors.bg} rounded-2xl p-4 border ${colors.border}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2.5 ${colors.bgDark} rounded-xl`}>
                    <Icon className={colors.text} size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{config.label}</h4>
                    <p className="text-sm text-gray-600">{appointment.doctor_name}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                        {formatDate(appointment.slot_date)}
                    </p>
                    <p className="text-xs text-gray-500">
                        {formatTime(appointment.start_time)}
                    </p>
                </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/50 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                    Queue Position: <strong>#{appointment.queue_position}</strong>
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-600' :
                    appointment.status === 'checked_in' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-gray-100 text-gray-600'
                }`}>
                    {appointment.status.replace('_', ' ')}
                </span>
            </div>
        </div>
    );
};

// Success Modal
const SuccessModal = ({ booking, onClose }) => {
    if (!booking) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="text-white" size={40} />
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">Batch Booked!</h3>
                <p className="text-gray-500 mb-6">{booking.message}</p>

                <div className="bg-primary-light/50 rounded-xl p-4 mb-6">
                    <p className="text-3xl font-bold text-primary">#{booking.position}</p>
                    <p className="text-sm text-gray-600">Your position in batch</p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
                >
                    Done
                </button>
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

    // Fetch initial data
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
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Fetch slots when search or type changes
    useEffect(() => {
        if (!searchTerm && !selectedType) {
            setSlots([]);
            return;
        }

        const fetchSlots = async () => {
            try {
                let url;
                if (searchTerm) {
                    url = `${API}/api/batching/suggest?appointmentType=${encodeURIComponent(searchTerm)}`;
                } else {
                    // Get slots for next 14 days
                    const today = new Date().toISOString().split('T')[0];
                    url = `${API}/api/batching/slots/all/${today}`;
                }

                const res = await fetch(url, { headers: authedHeaders() });
                const data = await res.json();
                
                if (searchTerm) {
                    setSlots(data.suggestions || []);
                } else {
                    setSlots(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Fetch slots error:', err);
            }
        };

        const debounce = setTimeout(fetchSlots, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, selectedType]);

    // Handle batch booking
    const handleBook = async (slotId) => {
        setIsBooking(true);
        try {
            const res = await fetch(`${API}/api/batching/book/${slotId}`, {
                method: 'POST',
                headers: authedHeaders(),
                body: JSON.stringify({ reason: searchTerm || selectedType })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Booking failed');
            }

            const data = await res.json();
            setSuccessBooking(data);

            // Refresh my appointments
            const myRes = await fetch(`${API}/api/batching/my-appointments`, { headers: authedHeaders() });
            const myApts = await myRes.json();
            setMyAppointments(Array.isArray(myApts) ? myApts : []);
        } catch (err) {
            alert(err.message);
        } finally {
            setIsBooking(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto p-10 text-center">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Loading batch appointments...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-10">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-500/30">
                        <Layers size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Batch Appointments</h1>
                        <p className="text-gray-500">Group appointments for vaccinations, check-ups & more</p>
                    </div>
                </div>
            </div>

            {/* My Upcoming Batch Appointments */}
            {myAppointments.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar className="text-primary" size={20} />
                        My Batch Appointments
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {myAppointments.map((apt) => (
                            <MyBatchCard key={apt.id} appointment={apt} />
                        ))}
                    </div>
                </div>
            )}

            {/* Search Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Search className="text-primary" size={18} />
                    Find Batch Appointments
                </h3>
                
                <div className="relative mb-6">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search (e.g., vaccination, checkup, follow-up)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Batch Type Filter */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {batchTypes.map((type) => (
                        <BatchTypeCard
                            key={type.id}
                            type={type}
                            isSelected={selectedType === type.id}
                            onClick={(id) => setSelectedType(selectedType === id ? null : id)}
                        />
                    ))}
                </div>
            </div>

            {/* Available Slots */}
            {(searchTerm || selectedType) && (
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Sparkles className="text-amber-500" size={20} />
                        Available Batch Slots
                    </h2>

                    {slots.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {slots.map((slot) => (
                                <BatchSlotCard
                                    key={slot.id}
                                    slot={slot}
                                    onBook={handleBook}
                                    isBooking={isBooking}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-2xl p-8 text-center">
                            <AlertCircle size={48} className="text-gray-300 mx-auto mb-4" />
                            <h3 className="font-semibold text-gray-700 mb-1">No Slots Available</h3>
                            <p className="text-sm text-gray-500">
                                No batch appointments found for this type. Try a different search or check back later.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* How It Works */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="text-violet-500" size={18} />
                    Why Batch Appointments?
                </h3>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-white/70 rounded-xl p-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                            <Clock className="text-emerald-600" size={20} />
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">Shorter Waits</h4>
                        <p className="text-xs text-gray-500">Optimized scheduling means less time waiting</p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                            <Users className="text-blue-600" size={20} />
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">Group Efficiency</h4>
                        <p className="text-xs text-gray-500">Similar appointments grouped for smoother flow</p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-4">
                        <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
                            <CheckCircle2 className="text-violet-600" size={20} />
                        </div>
                        <h4 className="font-medium text-gray-900 mb-1">Guaranteed Slot</h4>
                        <p className="text-xs text-gray-500">Reserve your spot in the batch ahead of time</p>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex gap-3">
                <button
                    onClick={() => navigate('/book')}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                    <Calendar size={18} />
                    Regular Booking
                </button>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                    Dashboard
                </button>
            </div>

            {/* Success Modal */}
            <SuccessModal 
                booking={successBooking} 
                onClose={() => setSuccessBooking(null)} 
            />
        </div>
    );
};

export default BatchAppointments;
