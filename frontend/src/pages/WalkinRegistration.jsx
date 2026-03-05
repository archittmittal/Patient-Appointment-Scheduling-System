/**
 * Issue #42: Walk-in Registration Page
 * Allows patients to register as walk-in with urgency selection
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    User, Clock, AlertCircle, Activity, Heart, Thermometer, 
    CheckCircle2, ArrowRight, ChevronDown, Stethoscope, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const URGENCY_LEVELS = [
    { 
        value: 'LOW', 
        label: 'Low Priority', 
        description: 'Minor issues, can wait', 
        color: 'border-gray-300 bg-gray-50',
        iconColor: 'text-gray-500',
        badge: 'bg-gray-100 text-gray-700'
    },
    { 
        value: 'NORMAL', 
        label: 'Normal', 
        description: 'Standard walk-in visit', 
        color: 'border-blue-300 bg-blue-50',
        iconColor: 'text-blue-500',
        badge: 'bg-blue-100 text-blue-700'
    },
    { 
        value: 'HIGH', 
        label: 'High Priority', 
        description: 'Priority case, shorter wait', 
        color: 'border-orange-300 bg-orange-50',
        iconColor: 'text-orange-500',
        badge: 'bg-orange-100 text-orange-700'
    },
    { 
        value: 'URGENT', 
        label: 'Urgent', 
        description: 'Immediate attention needed', 
        color: 'border-red-300 bg-red-50',
        iconColor: 'text-red-500',
        badge: 'bg-red-100 text-red-700'
    },
    { 
        value: 'EMERGENCY', 
        label: 'Emergency', 
        description: 'Life-threatening - immediate care', 
        color: 'border-red-500 bg-red-100',
        iconColor: 'text-red-600',
        badge: 'bg-red-500 text-white'
    }
];

// Urgency Selection Card
const UrgencyCard = ({ level, isSelected, onSelect }) => (
    <button
        onClick={() => onSelect(level.value)}
        className={`p-4 rounded-xl border-2 text-left transition-all ${
            isSelected 
                ? `${level.color} ring-2 ring-offset-2 ring-${level.iconColor.split('-')[1]}-400`
                : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
    >
        <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${isSelected ? level.badge : 'bg-gray-100'}`}>
                <Activity size={18} className={isSelected ? '' : 'text-gray-500'} />
            </div>
            <div>
                <h4 className="font-semibold text-gray-900">{level.label}</h4>
                <p className="text-sm text-gray-500 mt-0.5">{level.description}</p>
            </div>
        </div>
    </button>
);

// Vital Signs Input Section
const VitalSignsSection = ({ vitals, setVitals }) => (
    <div className="bg-gray-50 rounded-2xl p-5">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Heart size={18} className="text-red-500" />
            Vital Signs (Optional)
        </h4>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs text-gray-500 font-medium">Temperature (°C)</label>
                <div className="relative mt-1">
                    <Thermometer size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="number"
                        step="0.1"
                        min="35"
                        max="42"
                        placeholder="e.g., 37.5"
                        value={vitals.temperature || ''}
                        onChange={(e) => setVitals({ ...vitals, temperature: parseFloat(e.target.value) || null })}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs text-gray-500 font-medium">Heart Rate (bpm)</label>
                <div className="relative mt-1">
                    <Activity size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="number"
                        min="40"
                        max="200"
                        placeholder="e.g., 80"
                        value={vitals.heart_rate || ''}
                        onChange={(e) => setVitals({ ...vitals, heart_rate: parseInt(e.target.value) || null })}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs text-gray-500 font-medium">Blood Pressure</label>
                <div className="flex gap-2 mt-1">
                    <input
                        type="number"
                        placeholder="Sys"
                        min="70"
                        max="250"
                        value={vitals.bp_systolic || ''}
                        onChange={(e) => setVitals({ ...vitals, bp_systolic: parseInt(e.target.value) || null })}
                        className="w-1/2 px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                    <input
                        type="number"
                        placeholder="Dia"
                        min="40"
                        max="150"
                        value={vitals.bp_diastolic || ''}
                        onChange={(e) => setVitals({ ...vitals, bp_diastolic: parseInt(e.target.value) || null })}
                        className="w-1/2 px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                </div>
            </div>
            <div>
                <label className="text-xs text-gray-500 font-medium">Oxygen Saturation (%)</label>
                <input
                    type="number"
                    min="70"
                    max="100"
                    placeholder="e.g., 98"
                    value={vitals.oxygen_saturation || ''}
                    onChange={(e) => setVitals({ ...vitals, oxygen_saturation: parseInt(e.target.value) || null })}
                    className="w-full px-4 py-2.5 mt-1 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
            </div>
        </div>
    </div>
);

const WalkinRegistration = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [result, setResult] = useState(null);
    
    // Form state
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [urgency, setUrgency] = useState('NORMAL');
    const [reason, setReason] = useState('');
    const [symptoms, setSymptoms] = useState('');
    const [vitals, setVitals] = useState({});

    // Fetch available doctors
    useEffect(() => {
        fetch(`${API}/api/doctors`)
            .then(res => res.json())
            .then(data => setDoctors(Array.isArray(data) ? data : []))
            .catch(err => console.error('Failed to fetch doctors:', err));
    }, []);

    const handleSubmit = async () => {
        if (!selectedDoctor || !reason) {
            alert('Please select a doctor and provide a reason for visit');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API}/api/walkin/register`, {
                method: 'POST',
                headers: authedHeaders(),
                body: JSON.stringify({
                    doctorId: selectedDoctor.id,
                    urgencyLevel: urgency,
                    reason,
                    symptoms,
                    vitalSigns: Object.keys(vitals).length > 0 ? vitals : null
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Registration failed');
            }

            const data = await res.json();
            setResult(data);
            setStep(3);
        } catch (err) {
            alert(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 3: Success Screen
    if (step === 3 && result) {
        const urgencyConfig = URGENCY_LEVELS.find(l => l.value === urgency);
        
        return (
            <div className="max-w-lg mx-auto pt-10 pb-16 text-center animate-in fade-in">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="text-emerald-600" size={40} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Registered!</h1>
                <p className="text-gray-500 mb-8">{result.message}</p>

                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-left mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-primary-light/50 rounded-xl text-center">
                            <p className="text-4xl font-bold text-primary">#{result.queuePosition}</p>
                            <p className="text-sm text-gray-600 mt-1">Queue Position</p>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl text-center">
                            <p className="text-4xl font-bold text-orange-600">~{result.estimatedWaitMinutes}</p>
                            <p className="text-sm text-gray-600 mt-1">Minutes Wait</p>
                        </div>
                    </div>
                    
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Priority Level</span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${urgencyConfig?.badge}`}>
                                {urgencyConfig?.label}
                            </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-gray-500">Triage Score</span>
                            <span className="font-semibold text-gray-900">{result.triageScore}/200</span>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-left mb-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                        <div className="text-sm text-amber-800">
                            <p className="font-medium">Please stay in the waiting area</p>
                            <p className="mt-1">We'll call you when it's your turn. Keep your phone accessible for updates.</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/queue')}
                        className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
                    >
                        View Live Queue
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-10">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <Stethoscope className="text-primary" />
                    Walk-in Registration
                </h1>
                <p className="text-gray-500 mt-1">Register as a walk-in patient and join the queue</p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-2 mb-8">
                {[1, 2].map((s) => (
                    <React.Fragment key={s}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                            step >= s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                        }`}>
                            {s}
                        </div>
                        {s < 2 && <div className={`flex-1 h-1 rounded ${step > s ? 'bg-primary' : 'bg-gray-200'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {/* Step 1: Select Doctor & Urgency */}
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Doctor Selection */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <User size={18} className="text-primary" />
                            Select Doctor
                        </h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {doctors.map((doc) => (
                                <button
                                    key={doc.id}
                                    onClick={() => setSelectedDoctor(doc)}
                                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                                        selectedDoctor?.id === doc.id
                                            ? 'border-primary bg-primary-light/30'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <img 
                                            src={doc.image_url || `https://ui-avatars.com/api/?name=${doc.first_name}+${doc.last_name}&background=random`}
                                            alt={`Dr. ${doc.first_name}`}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                        <div>
                                            <h4 className="font-semibold text-gray-900">Dr. {doc.first_name} {doc.last_name}</h4>
                                            <p className="text-sm text-gray-500">{doc.specialty}</p>
                                        </div>
                                        {selectedDoctor?.id === doc.id && (
                                            <CheckCircle2 className="ml-auto text-primary" size={20} />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Urgency Selection */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-orange-500" />
                            Select Priority Level
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {URGENCY_LEVELS.map((level) => (
                                <UrgencyCard
                                    key={level.value}
                                    level={level}
                                    isSelected={urgency === level.value}
                                    onSelect={setUrgency}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setStep(2)}
                        disabled={!selectedDoctor}
                        className="w-full py-3.5 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Continue
                        <ArrowRight size={18} />
                    </button>
                </div>
            )}

            {/* Step 2: Details & Vitals */}
            {step === 2 && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">Visit Details</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                                    Reason for Visit *
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g., Headache, follow-up consultation"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                />
                            </div>
                            
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                                    Symptoms (Optional)
                                </label>
                                <textarea
                                    value={symptoms}
                                    onChange={(e) => setSymptoms(e.target.value)}
                                    placeholder="Describe your symptoms..."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <VitalSignsSection vitals={vitals} setVitals={setVitals} />

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || !reason}
                            className="flex-1 py-3.5 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={18} />
                                    Register as Walk-in
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalkinRegistration;
