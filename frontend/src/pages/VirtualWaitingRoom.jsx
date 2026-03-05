/**
 * Issue #39: Virtual Waiting Room Page
 * Allows patients to check-in remotely and track their queue status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Home, Clock, MapPin, CheckCircle2, AlertCircle, RefreshCw, 
    Navigation2, Car, Building2, Wifi, WifiOff, Bell, X, 
    Users, Timer, Sparkles, ArrowRight, Phone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const PING_INTERVAL = 30000; // 30 seconds
const POLL_INTERVAL = 15000; // 15 seconds

// Status indicator component
const StatusBadge = ({ status }) => {
    const statusConfig = {
        NOT_CHECKED_IN: { label: 'Not Checked In', color: 'bg-gray-100 text-gray-600', icon: Home },
        CHECKED_IN: { label: 'Checked In', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
        EN_ROUTE: { label: 'On The Way', color: 'bg-blue-100 text-blue-700', icon: Car },
        ARRIVED: { label: 'Arrived', color: 'bg-emerald-100 text-emerald-700', icon: Building2 }
    };
    
    const config = statusConfig[status] || statusConfig.NOT_CHECKED_IN;
    const Icon = config.icon;
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
            <Icon size={14} />
            {config.label}
        </span>
    );
};

// Connection indicator
const ConnectionStatus = ({ isConnected }) => (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
        isConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
    }`}>
        {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
        {isConnected ? 'Connected' : 'Reconnecting...'}
    </div>
);

// ETA Input Modal
const ETAModal = ({ isOpen, onClose, onSubmit, title }) => {
    const [eta, setEta] = useState(15);
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>
                <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Estimated arrival time (minutes)
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="5"
                            max="60"
                            value={eta}
                            onChange={(e) => setEta(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="w-16 text-center font-bold text-primary text-lg">{eta} min</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(eta)}
                        className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

const VirtualWaitingRoom = () => {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [status, setStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(true);
    const [showETAModal, setShowETAModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch waiting room status
    const fetchStatus = useCallback(async () => {
        if (!appointmentId || !user?.id) return;
        
        try {
            const res = await fetch(`${API}/api/virtual-checkin/${appointmentId}/status`, {
                headers: authedHeaders()
            });
            
            if (!res.ok) throw new Error('Failed to fetch status');
            
            const data = await res.json();
            setStatus(data);
            setIsConnected(true);
            setError(null);
        } catch (err) {
            console.error('Fetch status error:', err);
            setIsConnected(false);
            setError('Unable to connect. Retrying...');
        } finally {
            setIsLoading(false);
        }
    }, [appointmentId, user?.id]);

    // Keep session alive with heartbeat
    const pingSession = useCallback(async () => {
        if (!appointmentId || !status?.isCheckedIn) return;
        
        try {
            await fetch(`${API}/api/virtual-checkin/${appointmentId}/ping`, {
                method: 'POST',
                headers: authedHeaders()
            });
            setIsConnected(true);
        } catch (err) {
            setIsConnected(false);
        }
    }, [appointmentId, status?.isCheckedIn]);

    // Initial fetch and polling
    useEffect(() => {
        fetchStatus();
        const statusInterval = setInterval(fetchStatus, POLL_INTERVAL);
        return () => clearInterval(statusInterval);
    }, [fetchStatus]);

    // Session heartbeat
    useEffect(() => {
        if (!status?.isCheckedIn) return;
        
        const pingInterval = setInterval(pingSession, PING_INTERVAL);
        return () => clearInterval(pingInterval);
    }, [pingSession, status?.isCheckedIn]);

    // Handle virtual check-in
    const handleCheckin = async (etaMinutes) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API}/api/virtual-checkin/${appointmentId}/checkin`, {
                method: 'POST',
                headers: authedHeaders(),
                body: JSON.stringify({ etaMinutes, device: 'web' })
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Check-in failed');
            }
            
            await fetchStatus();
            setShowETAModal(false);
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Handle status update
    const handleStatusUpdate = async (newStatus, etaMinutes = null) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API}/api/virtual-checkin/${appointmentId}/status`, {
                method: 'POST',
                headers: authedHeaders(),
                body: JSON.stringify({ status: newStatus, etaMinutes })
            });
            
            if (!res.ok) throw new Error('Status update failed');
            
            await fetchStatus();
            setShowETAModal(false);
            setPendingAction(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Handle cancel check-in
    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel your virtual check-in?')) return;
        
        setActionLoading(true);
        try {
            await fetch(`${API}/api/virtual-checkin/${appointmentId}/checkin`, {
                method: 'DELETE',
                headers: authedHeaders()
            });
            await fetchStatus();
        } catch (err) {
            alert('Failed to cancel check-in');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle ETA modal actions
    const handleETASubmit = (eta) => {
        if (pendingAction === 'checkin') {
            handleCheckin(eta);
        } else if (pendingAction === 'enroute') {
            handleStatusUpdate('EN_ROUTE', eta);
        } else if (pendingAction === 'late') {
            handleStatusUpdate('RUNNING_LATE', eta);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Loading Virtual Waiting Room...</p>
                </div>
            </div>
        );
    }

    if (!status?.appointment) {
        return (
            <div className="max-w-lg mx-auto p-8 text-center">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-700 mb-2">Appointment Not Found</h2>
                <p className="text-gray-500 mb-6">This appointment doesn't exist or you don't have access to it.</p>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover"
                >
                    Go to Dashboard
                </button>
            </div>
        );
    }

    const { appointment, queue, isCheckedIn } = status;
    const currentStatus = appointment.virtualCheckinStatus;

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        Virtual Waiting Room
                        <span className="flex h-2.5 w-2.5 relative">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </span>
                    </h1>
                    <p className="text-gray-500 mt-1">Check in from home, arrive just in time</p>
                </div>
                <ConnectionStatus isConnected={isConnected} />
            </div>

            {/* Appointment Info Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-hover rounded-2xl flex items-center justify-center text-white">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">{appointment.doctor}</h3>
                            <p className="text-sm text-gray-500">{appointment.specialty}</p>
                        </div>
                    </div>
                    <StatusBadge status={currentStatus} />
                </div>
                
                <div className="flex items-center gap-6 text-sm text-gray-600 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        <span>{appointment.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-primary" />
                        <span>{new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    </div>
                </div>
            </div>

            {/* Queue Status Card */}
            {isCheckedIn && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-6 border border-blue-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="text-blue-600" size={20} />
                        <h4 className="font-bold text-blue-900">Queue Status</h4>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                            <p className="text-3xl font-bold text-blue-600">{queue?.position || '-'}</p>
                            <p className="text-xs text-gray-500 mt-1">Your Position</p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                            <p className="text-3xl font-bold text-blue-600">
                                {queue?.estimatedWaitMins || 0}
                                <span className="text-lg font-normal text-gray-400">m</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Est. Wait</p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
                            <p className="text-lg font-bold text-blue-600">
                                {queue?.estimatedCallTime 
                                    ? new Date(queue.estimatedCallTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                    : '-'
                                }
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Est. Call Time</p>
                        </div>
                    </div>

                    {appointment.checkinTime && (
                        <p className="text-xs text-blue-700 mt-4 text-center">
                            Checked in at {new Date(appointment.checkinTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="text-primary" size={18} />
                    Quick Actions
                </h4>
                
                {/* Not Checked In State */}
                {currentStatus === 'NOT_CHECKED_IN' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => { setPendingAction('checkin'); setShowETAModal(true); }}
                            disabled={actionLoading}
                            className="w-full py-4 bg-gradient-to-r from-primary to-primary-hover text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
                        >
                            <Home size={20} />
                            Check In Virtually
                            <ArrowRight size={18} />
                        </button>
                        <p className="text-sm text-gray-500 text-center">
                            Let the clinic know you're ready for your appointment
                        </p>
                    </div>
                )}

                {/* Checked In State */}
                {currentStatus === 'CHECKED_IN' && (
                    <div className="space-y-3">
                        <button
                            onClick={() => { setPendingAction('enroute'); setShowETAModal(true); }}
                            disabled={actionLoading}
                            className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Car size={18} />
                            I'm Leaving Now
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setPendingAction('late'); setShowETAModal(true); }}
                                disabled={actionLoading}
                                className="py-3 border border-orange-200 bg-orange-50 text-orange-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors disabled:opacity-50"
                            >
                                <Timer size={16} />
                                Running Late
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="py-3 border border-gray-200 text-gray-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                <X size={16} />
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* En Route State */}
                {currentStatus === 'EN_ROUTE' && (
                    <div className="space-y-3">
                        <button
                            onClick={() => handleStatusUpdate('ARRIVED')}
                            disabled={actionLoading}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-green-400/30 transition-all disabled:opacity-50"
                        >
                            <Building2 size={20} />
                            I've Arrived at the Clinic
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setPendingAction('late'); setShowETAModal(true); }}
                                disabled={actionLoading}
                                className="py-3 border border-orange-200 bg-orange-50 text-orange-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors disabled:opacity-50"
                            >
                                <Timer size={16} />
                                Update ETA
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="py-3 border border-gray-200 text-gray-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                <X size={16} />
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Arrived State */}
                {currentStatus === 'ARRIVED' && (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="text-emerald-600" size={32} />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-1">You're All Set!</h4>
                        <p className="text-gray-500 text-sm">
                            Please proceed to the reception desk. You'll be called shortly.
                        </p>
                    </div>
                )}
            </div>

            {/* Tips Card */}
            <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200">
                <div className="flex items-start gap-4">
                    <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600">
                        <Bell size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-900 mb-2">Tips for Your Visit</h4>
                        <ul className="space-y-2 text-sm text-amber-800">
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0"></span>
                                Keep this page open to stay connected to the queue
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0"></span>
                                You'll receive updates as your turn approaches
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0"></span>
                                Bring your ID and any required documents
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
                <button
                    onClick={() => navigate('/live-queue')}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                    <Users size={18} />
                    View Full Queue
                </button>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                    <Home size={18} />
                    Dashboard
                </button>
            </div>

            {/* ETA Modal */}
            <ETAModal
                isOpen={showETAModal}
                onClose={() => { setShowETAModal(false); setPendingAction(null); }}
                onSubmit={handleETASubmit}
                title={pendingAction === 'checkin' ? 'Virtual Check-in' : 'Update Your ETA'}
            />
        </div>
    );
};

export default VirtualWaitingRoom;
