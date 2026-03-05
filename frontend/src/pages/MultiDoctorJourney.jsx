/**
 * Issue #43: Multi-Doctor Journey Page
 * Beautiful UI for booking and tracking multi-specialist appointments
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Route, MapPin, Users, Clock, ChevronRight, Plus, X,
    CheckCircle2, Circle, Building2, ArrowRight, Sparkles,
    Search, Navigation, Stethoscope, AlertCircle, Layers,
    MoveRight, Building, Map
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

// Stop status badge
const StopStatusBadge = ({ status }) => {
    const config = {
        pending: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-600' },
        checked_in: { label: 'Checked In', bg: 'bg-blue-100', text: 'text-blue-600' },
        in_progress: { label: 'In Progress', bg: 'bg-amber-100', text: 'text-amber-600' },
        completed: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-600' },
        skipped: { label: 'Skipped', bg: 'bg-red-100', text: 'text-red-500' }
    };
    const { label, bg, text } = config[status] || config.pending;

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
            {label}
        </span>
    );
};

// Journey Stop Card
const JourneyStopCard = ({ stop, isActive, isLast }) => (
    <div className="flex gap-4">
        {/* Timeline line */}
        <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                stop.status === 'completed' 
                    ? 'bg-emerald-500'
                    : stop.status === 'in_progress'
                    ? 'bg-primary'
                    : 'bg-gray-200'
            }`}>
                {stop.status === 'completed' ? (
                    <CheckCircle2 className="text-white" size={20} />
                ) : (
                    <span className={`font-bold ${stop.status === 'in_progress' ? 'text-white' : 'text-gray-500'}`}>
                        {stop.stop_order}
                    </span>
                )}
            </div>
            {!isLast && (
                <div className={`w-0.5 h-16 ${
                    stop.status === 'completed' ? 'bg-emerald-300' : 'bg-gray-200'
                }`} />
            )}
        </div>

        {/* Card content */}
        <div className={`flex-1 pb-4 ${!isLast ? 'mb-4' : ''}`}>
            <div className={`bg-white rounded-xl border p-4 ${
                isActive ? 'border-primary shadow-md' : 'border-gray-100'
            }`}>
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h4 className="font-semibold text-gray-900">{stop.doctor_name}</h4>
                        <p className="text-sm text-gray-500">{stop.specialty}</p>
                    </div>
                    <StopStatusBadge status={stop.status} />
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                    {stop.building && (
                        <span className="flex items-center gap-1">
                            <Building2 size={14} className="text-primary" />
                            Building {stop.building}
                        </span>
                    )}
                    {stop.floor_number && (
                        <span className="flex items-center gap-1">
                            <Layers size={14} className="text-primary" />
                            Floor {stop.floor_number}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Clock size={14} className="text-primary" />
                        ~{stop.estimated_duration_mins || 20}m
                    </span>
                </div>

                {stop.reason && (
                    <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        {stop.reason}
                    </p>
                )}
            </div>
        </div>
    </div>
);

// Active Journey Card for overview
const ActiveJourneyCard = ({ journey, onClick }) => {
    const completedStops = journey.completed_stops || journey.stops?.filter(s => s.status === 'completed').length || 0;
    const progress = Math.round((completedStops / journey.total_stops) * 100);
    const currentStop = journey.stops?.find(s => s.status === 'in_progress') || 
                       journey.stops?.find(s => s.status === 'pending');

    return (
        <button
            onClick={onClick}
            className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all text-left"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl">
                        <Route className="text-violet-600" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">
                            {journey.total_stops}-Doctor Journey
                        </h3>
                        <p className="text-sm text-gray-500">
                            {completedStops} of {journey.total_stops} stops completed
                        </p>
                    </div>
                </div>
                <ChevronRight className="text-gray-400" size={20} />
            </div>

            {/* Progress bar */}
            <div className="mb-4">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Current stop info */}
            {currentStop && (
                <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
                    <div className="p-2 bg-white rounded-lg">
                        <Navigation className="text-violet-600" size={16} />
                    </div>
                    <div>
                        <p className="text-xs text-violet-600 font-medium">Next Stop</p>
                        <p className="text-sm text-gray-900">{currentStop.doctor_name}</p>
                    </div>
                </div>
            )}
        </button>
    );
};

// Doctor Selection Card
const DoctorSelectCard = ({ doctor, isSelected, onToggle }) => (
    <button
        onClick={() => onToggle(doctor)}
        className={`p-4 rounded-xl border-2 transition-all text-left ${
            isSelected 
                ? 'border-primary bg-primary-light/50'
                : 'border-gray-100 bg-white hover:border-gray-200'
        }`}
    >
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isSelected ? 'bg-primary text-white' : 'bg-gray-100'
            }`}>
                <Stethoscope size={18} className={isSelected ? '' : 'text-gray-500'} />
            </div>
            <div className="flex-1">
                <h4 className="font-medium text-gray-900">{doctor.name}</h4>
                <p className="text-sm text-gray-500">{doctor.specialty}</p>
            </div>
            {isSelected && (
                <CheckCircle2 className="text-primary" size={20} />
            )}
        </div>
        {doctor.floor_number && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-2">
                <Building2 size={12} />
                <span>Building {doctor.building || 'A'}, Floor {doctor.floor_number}</span>
            </div>
        )}
    </button>
);

// Main Component
const MultiDoctorJourney = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [journeys, setJourneys] = useState([]);
    const [selectedJourney, setSelectedJourney] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // Create journey state
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctors, setSelectedDoctors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState(null);

    // Fetch journeys
    useEffect(() => {
        const fetchJourneys = async () => {
            try {
                const res = await fetch(`${API}/api/multi-doctor/journeys`, {
                    headers: authedHeaders()
                });
                const data = await res.json();
                setJourneys(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchJourneys();
    }, []);

    // Fetch doctors when creating
    useEffect(() => {
        if (showCreateModal) {
            fetch(`${API}/api/doctors`, { headers: authedHeaders() })
                .then(res => res.json())
                .then(data => setDoctors(Array.isArray(data) ? data : []))
                .catch(err => console.error(err));
        }
    }, [showCreateModal]);

    // Get symptom suggestions
    const handleSymptomSearch = async () => {
        if (!searchTerm.trim()) return;
        
        try {
            const res = await fetch(`${API}/api/multi-doctor/suggestions?symptom=${encodeURIComponent(searchTerm)}`, {
                headers: authedHeaders()
            });
            const data = await res.json();
            setSuggestions(data);
        } catch (err) {
            console.error(err);
        }
    };

    // Toggle doctor selection
    const toggleDoctor = (doctor) => {
        setSelectedDoctors(prev => {
            const exists = prev.find(d => d.id === doctor.id);
            if (exists) {
                return prev.filter(d => d.id !== doctor.id);
            }
            return [...prev, doctor];
        });
    };

    // Create journey
    const handleCreateJourney = async () => {
        if (selectedDoctors.length < 2) {
            alert('Please select at least 2 doctors');
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch(`${API}/api/multi-doctor/journey`, {
                method: 'POST',
                headers: authedHeaders(),
                body: JSON.stringify({
                    appointments: selectedDoctors.map(d => ({
                        doctorId: d.id,
                        reason: 'Consultation'
                    }))
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create journey');
            }

            const data = await res.json();
            setJourneys(prev => [data, ...prev]);
            setShowCreateModal(false);
            setSelectedDoctors([]);
            setSearchTerm('');
            setSuggestions(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    // Filter doctors
    const filteredDoctors = doctors.filter(d => 
        d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto p-10 text-center">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Loading journeys...</p>
            </div>
        );
    }

    // Show journey details
    if (selectedJourney) {
        const completedStops = selectedJourney.stops?.filter(s => s.status === 'completed').length || 0;
        const progress = Math.round((completedStops / selectedJourney.total_stops) * 100);

        return (
            <div className="max-w-2xl mx-auto pb-10">
                <button
                    onClick={() => setSelectedJourney(null)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
                >
                    <ArrowRight size={18} className="rotate-180" />
                    <span>Back</span>
                </button>

                {/* Header */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-6 mb-6 border border-violet-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-500/30">
                            <Route size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Your Journey
                            </h2>
                            <p className="text-gray-600">
                                {completedStops} of {selectedJourney.total_stops} stops completed
                            </p>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="bg-white rounded-xl p-4">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-500">Progress</span>
                            <span className="font-semibold text-gray-900">{progress}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Est. total time: {selectedJourney.totalEstimatedMins || (selectedJourney.total_stops * 20)} mins
                        </p>
                    </div>
                </div>

                {/* Stops Timeline */}
                <div className="mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Map className="text-primary" size={18} />
                        Your Route
                    </h3>
                    <div>
                        {selectedJourney.stops?.map((stop, idx) => (
                            <JourneyStopCard
                                key={stop.id}
                                stop={stop}
                                isActive={stop.status === 'in_progress' || (stop.status === 'pending' && idx === selectedJourney.stops.findIndex(s => s.status === 'pending'))}
                                isLast={idx === selectedJourney.stops.length - 1}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-10">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-500/30">
                        <Route size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Multi-Doctor Journey</h1>
                        <p className="text-gray-500">Optimized routing for multiple specialists</p>
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-5 mb-6 border border-violet-100">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                        <Navigation className="text-violet-500" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-violet-900">Smart Route Planning</h3>
                        <p className="text-sm text-violet-700 mt-1">
                            We optimize your route between doctors to minimize walking and waiting time
                        </p>
                    </div>
                </div>
            </div>

            {/* Active Journeys */}
            {journeys.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <MapPin className="text-primary" size={20} />
                        Active Journeys
                    </h2>
                    <div className="space-y-4">
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

            {/* Create New Journey */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="w-full p-6 border-2 border-dashed border-gray-200 rounded-2xl hover:border-primary hover:bg-primary-light/20 transition-all flex items-center justify-center gap-3 group"
            >
                <div className="p-3 bg-gray-100 rounded-xl group-hover:bg-primary/10">
                    <Plus className="text-gray-500 group-hover:text-primary" size={24} />
                </div>
                <div className="text-left">
                    <h3 className="font-semibold text-gray-900">Create New Journey</h3>
                    <p className="text-sm text-gray-500">Plan visits to multiple doctors</p>
                </div>
            </button>

            {/* Features */}
            <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="text-violet-500" size={18} />
                    Why Use Multi-Doctor Journey?
                </h3>
                <div className="grid gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Navigation size={16} className="text-violet-500" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 text-sm">Optimized Route</h4>
                            <p className="text-xs text-gray-500">We plan the best path between doctors</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Clock size={16} className="text-emerald-500" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 text-sm">Save Time</h4>
                            <p className="text-xs text-gray-500">Complete all visits in one trip</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Map size={16} className="text-blue-500" />
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900 text-sm">Easy Tracking</h4>
                            <p className="text-xs text-gray-500">Follow your progress through each stop</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900">Create Journey</h2>
                                <button
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setSelectedDoctors([]);
                                        setSuggestions(null);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {/* Symptom search */}
                            <div className="mb-6">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Describe your symptoms (optional)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g., chest pain, headache"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    <button
                                        onClick={handleSymptomSearch}
                                        className="px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover"
                                    >
                                        <Search size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Suggestions */}
                            {suggestions?.suggestedSpecialties?.length > 0 && (
                                <div className="mb-6 bg-amber-50 rounded-xl p-4 border border-amber-100">
                                    <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                                        <Sparkles size={16} className="text-amber-500" />
                                        Recommended Specialists
                                    </h4>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {suggestions.suggestedSpecialties.map((spec, idx) => (
                                            <React.Fragment key={spec}>
                                                <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-medium text-gray-900">
                                                    {spec}
                                                </span>
                                                {idx < suggestions.suggestedSpecialties.length - 1 && (
                                                    <MoveRight size={16} className="text-amber-400" />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Selected doctors */}
                            {selectedDoctors.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                        Selected ({selectedDoctors.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedDoctors.map(doc => (
                                            <span
                                                key={doc.id}
                                                className="px-3 py-1.5 bg-primary-light text-primary rounded-lg text-sm font-medium flex items-center gap-2"
                                            >
                                                {doc.name}
                                                <button onClick={() => toggleDoctor(doc)}>
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Doctor list */}
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">
                                    Select Doctors (min 2)
                                </h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {filteredDoctors.map(doctor => (
                                        <DoctorSelectCard
                                            key={doctor.id}
                                            doctor={doctor}
                                            isSelected={selectedDoctors.some(d => d.id === doctor.id)}
                                            onToggle={toggleDoctor}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100">
                            <button
                                onClick={handleCreateJourney}
                                disabled={selectedDoctors.length < 2 || isCreating}
                                className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isCreating ? 'Creating...' : `Create Journey (${selectedDoctors.length} stops)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiDoctorJourney;
