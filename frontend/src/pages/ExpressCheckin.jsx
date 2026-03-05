/**
 * Issue #45: Express Check-in Page
 * Beautiful fast-track check-in experience for returning patients
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    QrCode, Zap, CheckCircle2, Clock, User, Calendar, 
    ChevronRight, Sparkles, Shield, Award, ArrowRight,
    Smartphone, ScanLine, Timer, MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

// Animated checkmark for success
const AnimatedCheck = () => (
    <div className="relative w-24 h-24">
        <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="text-white" size={48} />
        </div>
    </div>
);

// Express badge for eligible appointments
const ExpressBadge = ({ eligible }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
        eligible 
            ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200'
            : 'bg-gray-100 text-gray-500'
    }`}>
        {eligible ? (
            <>
                <Zap size={12} className="text-amber-500" />
                Express Eligible
            </>
        ) : (
            <>Standard Check-in</>
        )}
    </span>
);

// QR Code Display Component
const QRCodeDisplay = ({ qrData, onClose }) => {
    if (!qrData) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-hover rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <QrCode className="text-white" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Your Check-in QR Code</h3>
                    <p className="text-sm text-gray-500 mt-1">Show this at the clinic kiosk</p>
                </div>
                
                {/* QR Code Placeholder - In production, use a QR library */}
                <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                    <div className="w-48 h-48 mx-auto bg-white rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                        <div className="text-center">
                            <ScanLine size={48} className="text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-400 font-mono">{qrData.token?.slice(0, 16)}...</p>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-4 mb-6">
                    <p className="text-sm text-amber-800 text-center">
                        <Timer size={14} className="inline mr-1" />
                        Valid for 24 hours
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

// Appointment Card for Express Check-in
const AppointmentCard = ({ appointment, onOneTap, onGenerateQR, isLoading }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="p-5">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-light to-blue-100 rounded-xl flex items-center justify-center">
                        <User className="text-primary" size={20} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900">{appointment.doctor}</h4>
                        <p className="text-sm text-gray-500">{appointment.specialty}</p>
                    </div>
                </div>
                <ExpressBadge eligible={appointment.isExpressEligible} />
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-primary" />
                    <span>{appointment.time}</span>
                </div>
                {appointment.previousVisits > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Award size={14} className="text-amber-500" />
                        <span>{appointment.previousVisits} previous visits</span>
                    </div>
                )}
            </div>

            {appointment.isExpressEligible ? (
                <div className="flex gap-2">
                    <button
                        onClick={() => onOneTap(appointment.id)}
                        disabled={isLoading}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
                    >
                        <Zap size={18} />
                        One-Tap Check-in
                    </button>
                    <button
                        onClick={() => onGenerateQR(appointment.id)}
                        disabled={isLoading}
                        className="px-4 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        <QrCode size={18} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => onGenerateQR(appointment.id)}
                    disabled={isLoading}
                    className="w-full py-3 border border-gray-200 rounded-xl text-gray-700 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <QrCode size={16} />
                    Generate QR Code
                </button>
            )}
        </div>
    </div>
);

// Success Screen Component
const SuccessScreen = ({ result, onViewQueue, onDashboard }) => (
    <div className="text-center animate-in fade-in zoom-in-95 duration-500">
        <AnimatedCheck />
        
        <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">
            You're Checked In!
        </h1>
        <p className="text-gray-500 mb-8">{result.message}</p>

        <div className="bg-gradient-to-br from-primary-light/50 to-blue-50 rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-4xl font-bold text-primary">#{result.queuePosition}</p>
                    <p className="text-sm text-gray-500 mt-1">Queue Position</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-4xl font-bold text-primary">
                        {result.estimatedWaitMins || '~15'}
                        <span className="text-lg font-normal text-gray-400">m</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Est. Wait</p>
                </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/50">
                <p className="text-sm text-gray-600">
                    <Clock size={14} className="inline mr-1" />
                    Checked in at {new Date(result.checkinTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
            </div>
        </div>

        <div className="flex gap-3">
            <button
                onClick={onViewQueue}
                className="flex-1 py-3.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
            >
                View Live Queue
            </button>
            <button
                onClick={onDashboard}
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
                Dashboard
            </button>
        </div>
    </div>
);

const ExpressCheckin = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [qrData, setQrData] = useState(null);
    const [success, setSuccess] = useState(null);
    const [prefilledInfo, setPrefilledInfo] = useState(null);

    // Fetch today's eligible appointments
    useEffect(() => {
        if (!user?.id) return;

        const fetchData = async () => {
            try {
                const [aptRes, infoRes] = await Promise.all([
                    fetch(`${API}/api/express-checkin/today`, { headers: authedHeaders() }),
                    fetch(`${API}/api/express-checkin/prefilled-info`, { headers: authedHeaders() })
                ]);

                const aptData = await aptRes.json();
                const infoData = await infoRes.json();

                setAppointments(Array.isArray(aptData) ? aptData : []);
                setPrefilledInfo(infoData);
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user?.id]);

    // Handle one-tap check-in
    const handleOneTap = async (appointmentId) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API}/api/express-checkin/one-tap/${appointmentId}`, {
                method: 'POST',
                headers: authedHeaders()
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Check-in failed');
            }

            const data = await res.json();
            setSuccess(data);
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Handle QR code generation
    const handleGenerateQR = async (appointmentId) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API}/api/express-checkin/generate-token/${appointmentId}`, {
                method: 'POST',
                headers: authedHeaders()
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to generate QR code');
            }

            const data = await res.json();
            setQrData(data);
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto p-10 text-center">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Loading your appointments...</p>
            </div>
        );
    }

    // Show success screen
    if (success) {
        return (
            <div className="max-w-md mx-auto pt-10 pb-16">
                <SuccessScreen 
                    result={success}
                    onViewQueue={() => navigate('/queue')}
                    onDashboard={() => navigate('/dashboard')}
                />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-10">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl text-white shadow-lg shadow-amber-500/30">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Express Check-in</h1>
                        <p className="text-gray-500">Skip the line with one-tap or QR check-in</p>
                    </div>
                </div>
            </div>

            {/* Returning Patient Banner */}
            {prefilledInfo?.hasHistory && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 mb-6 border border-emerald-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Award className="text-emerald-600" size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-emerald-900">Welcome back, {user?.first_name}!</h3>
                            <p className="text-sm text-emerald-700 mt-0.5">
                                You're a returning patient with {prefilledInfo.totalVisits || 0} previous visits
                            </p>
                        </div>
                        <div className="ml-auto">
                            <Shield className="text-emerald-400" size={32} />
                        </div>
                    </div>
                </div>
            )}

            {/* Features Info */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Zap size={16} className="text-emerald-600" />
                        </div>
                        <span className="font-semibold text-gray-900">One-Tap</span>
                    </div>
                    <p className="text-xs text-gray-500">Instant check-in for returning patients</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <QrCode size={16} className="text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-900">QR Code</span>
                    </div>
                    <p className="text-xs text-gray-500">Scan at clinic kiosk for quick entry</p>
                </div>
            </div>

            {/* Today's Appointments */}
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="text-primary" size={20} />
                    Today's Appointments
                </h2>

                {appointments.length > 0 ? (
                    <div className="space-y-4">
                        {appointments.map((apt) => (
                            <AppointmentCard
                                key={apt.id}
                                appointment={apt}
                                onOneTap={handleOneTap}
                                onGenerateQR={handleGenerateQR}
                                isLoading={actionLoading}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center">
                        <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
                        <h3 className="font-semibold text-gray-700 mb-1">No Appointments Today</h3>
                        <p className="text-sm text-gray-500 mb-4">You don't have any appointments scheduled for today</p>
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

            {/* How It Works */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="text-amber-500" size={18} />
                    How Express Check-in Works
                </h3>
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-hover rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            1
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">Returning Patient?</h4>
                            <p className="text-sm text-gray-500">If you've visited before, you're eligible for one-tap check-in</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-hover rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            2
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">Tap or Scan</h4>
                            <p className="text-sm text-gray-500">Use one-tap button or generate a QR code to scan at the kiosk</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-hover rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            3
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">You're Done!</h4>
                            <p className="text-sm text-gray-500">Skip the queue and wait comfortably - we'll notify you when it's your turn</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex gap-3">
                <button
                    onClick={() => navigate('/queue')}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                    <Clock size={18} />
                    View Queue
                </button>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                    Dashboard
                </button>
            </div>

            {/* QR Code Modal */}
            <QRCodeDisplay qrData={qrData} onClose={() => setQrData(null)} />
        </div>
    );
};

export default ExpressCheckin;
