/**
 * Issue #46: Patient Prep Checklist Page
 * Beautiful UI for pre-appointment preparation instructions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    ClipboardCheck, CheckCircle2, Circle, AlertTriangle, Clock,
    Calendar, User, ChevronRight, Sparkles, ArrowRight,
    ChevronDown, ChevronUp, Star, Bell, ArrowLeft,
    Stethoscope, Heart, Eye, Syringe, FlaskConical, Pill
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

// Priority badges
const PriorityBadge = ({ priority }) => {
    const config = {
        required: { label: 'Required', bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
        recommended: { label: 'Recommended', bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
        optional: { label: 'Optional', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' }
    };
    const { label, bg, text, border } = config[priority] || config.optional;

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text} border ${border}`}>
            {label}
        </span>
    );
};

// Prep Item Component
const PrepItem = ({ item, onToggle, isUpdating }) => {
    const handleClick = () => {
        if (!isUpdating) {
            onToggle(item.id, !item.isCompleted);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={isUpdating}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
                item.isCompleted
                    ? 'bg-emerald-50 border-emerald-200'
                    : item.priority === 'required'
                    ? 'bg-white border-red-100 hover:border-red-200 hover:bg-red-50/30'
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
        >
            {/* Checkbox */}
            <div className="flex-shrink-0 mt-0.5">
                {item.isCompleted ? (
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="text-white" size={16} />
                    </div>
                ) : (
                    <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center ${
                        item.priority === 'required' ? 'border-red-300' : 'border-gray-300'
                    }`}>
                        <Circle className="text-transparent" size={16} />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{item.icon}</span>
                    <span className={`font-medium ${item.isCompleted ? 'text-emerald-800 line-through' : 'text-gray-900'}`}>
                        {item.label}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    {item.notes && (
                        <span className="text-xs text-gray-500">{item.notes}</span>
                    )}
                </div>
            </div>
        </button>
    );
};

// Progress Ring Component
const ProgressRing = ({ progress, size = 120, strokeWidth = 8 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    const getColor = () => {
        if (progress >= 100) return 'text-emerald-500';
        if (progress >= 75) return 'text-blue-500';
        if (progress >= 50) return 'text-amber-500';
        return 'text-red-500';
    };

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    className="text-gray-100"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={`${getColor()} transition-all duration-500`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
            </svg>
            <div className="absolute text-center">
                <span className={`text-2xl font-bold ${getColor()}`}>{progress}%</span>
                <p className="text-xs text-gray-500">Complete</p>
            </div>
        </div>
    );
};

// Appointment Card for Overview
const AppointmentPrepCard = ({ appointment, onClick }) => {
    const progress = appointment.prepProgress?.percentage || 0;
    const requiredDone = appointment.prepProgress?.requiredCompleted || 0;
    const requiredTotal = appointment.prepProgress?.requiredTotal || 0;
    const allRequiredDone = requiredDone >= requiredTotal;

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
        <button
            onClick={onClick}
            className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all text-left"
        >
            <div className="flex items-start gap-4">
                {/* Progress indicator */}
                <div className="relative">
                    <ProgressRing progress={progress} size={72} strokeWidth={6} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{appointment.doctor_name}</h3>
                        {!allRequiredDone && (
                            <span className="flex-shrink-0 p-1 bg-red-100 rounded-full">
                                <AlertTriangle size={12} className="text-red-500" />
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{appointment.specialty || 'General'}</p>
                    
                    <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-primary">
                            <Calendar size={14} />
                            {formatDate(appointment.appointment_date)}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                            <Clock size={14} />
                            {formatTime(appointment.appointment_time)}
                        </span>
                    </div>

                    {/* Required items status */}
                    <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className={`text-xs font-medium ${allRequiredDone ? 'text-emerald-600' : 'text-red-600'}`}>
                            {allRequiredDone ? '✓ All required items done' : `${requiredTotal - requiredDone} required items pending`}
                        </span>
                    </div>
                </div>

                <ChevronRight className="text-gray-400 flex-shrink-0" size={20} />
            </div>
        </button>
    );
};

// Main Component
const PrepChecklist = () => {
    const navigate = useNavigate();
    const { appointmentId } = useParams();
    const { user } = useAuth();
    
    const [overview, setOverview] = useState([]);
    const [selectedPrep, setSelectedPrep] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [expandedSection, setExpandedSection] = useState('required');

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            try {
                if (appointmentId) {
                    // Fetch specific appointment prep
                    const res = await fetch(`${API}/api/prep/appointment/${appointmentId}`, {
                        headers: authedHeaders()
                    });
                    const data = await res.json();
                    setSelectedPrep(data);
                } else {
                    // Fetch overview
                    const res = await fetch(`${API}/api/prep/overview`, {
                        headers: authedHeaders()
                    });
                    const data = await res.json();
                    setOverview(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [appointmentId]);

    // Handle item toggle
    const handleToggle = async (itemId, completed) => {
        if (!selectedPrep) return;
        
        setIsUpdating(true);
        try {
            const method = completed ? 'POST' : 'DELETE';
            await fetch(`${API}/api/prep/complete/${selectedPrep.appointment.id}/${itemId}`, {
                method,
                headers: authedHeaders()
            });

            // Update local state
            setSelectedPrep(prev => ({
                ...prev,
                items: prev.items.map(item => 
                    item.id === itemId ? { ...item, isCompleted: completed } : item
                ),
                completedCount: prev.completedCount + (completed ? 1 : -1)
            }));
        } catch (err) {
            console.error('Toggle error:', err);
        } finally {
            setIsUpdating(false);
        }
    };

    // Group items by priority
    const groupedItems = selectedPrep?.items?.reduce((acc, item) => {
        const key = item.priority || 'recommended';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {}) || {};

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto p-10 text-center">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Loading prep checklist...</p>
            </div>
        );
    }

    // Show specific appointment prep
    if (selectedPrep) {
        const progress = selectedPrep.totalCount > 0 
            ? Math.round((selectedPrep.completedCount / selectedPrep.totalCount) * 100)
            : 100;

        return (
            <div className="max-w-2xl mx-auto pb-10">
                {/* Back Button */}
                <button
                    onClick={() => appointmentId ? navigate('/prep-checklist') : setSelectedPrep(null)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Overview</span>
                </button>

                {/* Header with Progress */}
                <div className="bg-gradient-to-br from-primary-light/50 to-blue-50 rounded-3xl p-6 mb-6">
                    <div className="flex items-center gap-6">
                        <ProgressRing progress={progress} size={100} strokeWidth={8} />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">
                                {selectedPrep.appointment.doctorName}
                            </h2>
                            <p className="text-gray-600 mb-2">{selectedPrep.appointment.specialty}</p>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} className="text-primary" />
                                    {new Date(selectedPrep.appointment.date).toLocaleDateString('en-US', {
                                        weekday: 'short', month: 'short', day: 'numeric'
                                    })}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={14} className="text-primary" />
                                    {selectedPrep.appointment.time}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Required Items */}
                {groupedItems.required?.length > 0 && (
                    <div className="mb-6">
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'required' ? '' : 'required')}
                            className="w-full flex items-center justify-between mb-3"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-red-100 rounded-lg">
                                    <AlertTriangle size={16} className="text-red-500" />
                                </div>
                                <h3 className="font-bold text-gray-900">Required Items</h3>
                                <span className="text-sm text-gray-500">
                                    ({groupedItems.required.filter(i => i.isCompleted).length}/{groupedItems.required.length})
                                </span>
                            </div>
                            {expandedSection === 'required' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {expandedSection === 'required' && (
                            <div className="space-y-3">
                                {groupedItems.required.map(item => (
                                    <PrepItem 
                                        key={item.id} 
                                        item={item} 
                                        onToggle={handleToggle}
                                        isUpdating={isUpdating}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Recommended Items */}
                {groupedItems.recommended?.length > 0 && (
                    <div className="mb-6">
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'recommended' ? '' : 'recommended')}
                            className="w-full flex items-center justify-between mb-3"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-100 rounded-lg">
                                    <Star size={16} className="text-amber-500" />
                                </div>
                                <h3 className="font-bold text-gray-900">Recommended Items</h3>
                                <span className="text-sm text-gray-500">
                                    ({groupedItems.recommended.filter(i => i.isCompleted).length}/{groupedItems.recommended.length})
                                </span>
                            </div>
                            {expandedSection === 'recommended' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {expandedSection === 'recommended' && (
                            <div className="space-y-3">
                                {groupedItems.recommended.map(item => (
                                    <PrepItem 
                                        key={item.id} 
                                        item={item} 
                                        onToggle={handleToggle}
                                        isUpdating={isUpdating}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Optional Items */}
                {groupedItems.optional?.length > 0 && (
                    <div className="mb-6">
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'optional' ? '' : 'optional')}
                            className="w-full flex items-center justify-between mb-3"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-gray-100 rounded-lg">
                                    <ClipboardCheck size={16} className="text-gray-500" />
                                </div>
                                <h3 className="font-bold text-gray-900">Optional Items</h3>
                                <span className="text-sm text-gray-500">
                                    ({groupedItems.optional.filter(i => i.isCompleted).length}/{groupedItems.optional.length})
                                </span>
                            </div>
                            {expandedSection === 'optional' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {expandedSection === 'optional' && (
                            <div className="space-y-3">
                                {groupedItems.optional.map(item => (
                                    <PrepItem 
                                        key={item.id} 
                                        item={item} 
                                        onToggle={handleToggle}
                                        isUpdating={isUpdating}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Completion message */}
                {progress === 100 && (
                    <div className="bg-emerald-50 rounded-2xl p-6 text-center border border-emerald-200">
                        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="text-white" size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-emerald-900 mb-1">All Set!</h3>
                        <p className="text-emerald-700">You've completed all preparation items</p>
                    </div>
                )}
            </div>
        );
    }

    // Show overview
    return (
        <div className="max-w-2xl mx-auto pb-10">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-500/30">
                        <ClipboardCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Prep Checklist</h1>
                        <p className="text-gray-500">Pre-appointment preparation instructions</p>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-5 mb-6 border border-amber-100">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                        <Sparkles className="text-amber-500" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-amber-900">Be Prepared, Save Time</h3>
                        <p className="text-sm text-amber-700 mt-1">
                            Complete your prep checklist before your appointment for a smoother visit
                        </p>
                    </div>
                </div>
            </div>

            {/* Appointments with prep */}
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="text-primary" size={20} />
                    Upcoming Appointments
                </h2>

                {overview.length > 0 ? (
                    <div className="space-y-4">
                        {overview.map((apt) => (
                            <AppointmentPrepCard
                                key={apt.id}
                                appointment={apt}
                                onClick={() => navigate(`/prep-checklist/${apt.id}`)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center">
                        <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
                        <h3 className="font-semibold text-gray-700 mb-1">No Upcoming Appointments</h3>
                        <p className="text-sm text-gray-500 mb-4">Book an appointment to see your prep checklist</p>
                        <button
                            onClick={() => navigate('/book')}
                            className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-2"
                        >
                            Book Appointment
                            <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Quick Tips */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="text-primary" size={18} />
                    Quick Tips
                </h3>
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={16} className="text-red-500" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 text-sm">Required Items</h4>
                            <p className="text-xs text-gray-500">Must be completed before your appointment</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Star size={16} className="text-amber-500" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 text-sm">Recommended Items</h4>
                            <p className="text-xs text-gray-500">Helpful for a better consultation experience</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Bell size={16} className="text-emerald-500" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 text-sm">Reminders</h4>
                            <p className="text-xs text-gray-500">We'll remind you of pending items before your visit</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrepChecklist;
