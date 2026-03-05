import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import API from '../config/api';
import { 
    Clock, 
    AlertTriangle, 
    CheckCircle2, 
    Timer,
    Calendar,
    RefreshCw,
    ArrowRight,
    Hourglass,
    ChevronRight,
    Shield,
    XCircle,
    Zap,
    AlarmClock
} from 'lucide-react';

const LateArrival = () => {
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [result, setResult] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    const appointmentId = searchParams.get('appointment');

    useEffect(() => {
        if (appointmentId) {
            checkLateStatus(appointmentId);
        } else {
            fetchTodayAppointments();
        }
    }, [appointmentId]);

    const fetchTodayAppointments = async () => {
        try {
            const res = await API.get('/appointments/my');
            const today = new Date().toISOString().split('T')[0];
            const todayApts = res.data.filter(apt => 
                apt.appointment_date.split('T')[0] === today &&
                ['scheduled', 'confirmed'].includes(apt.status)
            );
            setAppointments(todayApts);
        } catch (err) {
            console.error('Error fetching appointments:', err);
        } finally {
            setLoading(false);
        }
    };

    const checkLateStatus = async (aptId) => {
        setLoading(true);
        try {
            const res = await API.get(`/late-arrival/check/${aptId}`);
            setStatus(res.data);
            setSelectedAppointment(aptId);
        } catch (err) {
            console.error('Error checking late status:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOptionSelect = async (optionId) => {
        setSelectedOption(optionId);
        setProcessing(true);

        try {
            const res = await API.post('/late-arrival/process', {
                appointmentId: selectedAppointment,
                optionId
            });
            setResult(res.data);
        } catch (err) {
            console.error('Error processing option:', err);
        } finally {
            setProcessing(false);
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    const getStatusColor = () => {
        if (!status) return 'blue';
        if (status.isWithinGrace) return 'green';
        if (status.canStillBeAccommodated) return 'yellow';
        if (!status.shouldAutoReschedule) return 'orange';
        return 'red';
    };

    const getOptionIcon = (optionId) => {
        switch (optionId) {
            case 'proceed': return <CheckCircle2 className="w-6 h-6" />;
            case 'fit_in': return <Timer className="w-6 h-6" />;
            case 'end_of_session': return <Hourglass className="w-6 h-6" />;
            case 'reschedule': return <RefreshCw className="w-6 h-6" />;
            default: return <Clock className="w-6 h-6" />;
        }
    };

    const getOptionColor = (optionId, recommended) => {
        if (recommended) {
            switch (optionId) {
                case 'proceed': return 'from-green-500 to-emerald-600';
                case 'fit_in': return 'from-blue-500 to-indigo-600';
                case 'end_of_session': return 'from-amber-500 to-orange-600';
                case 'reschedule': return 'from-purple-500 to-violet-600';
                default: return 'from-gray-500 to-gray-600';
            }
        }
        return 'from-gray-400 to-gray-500';
    };

    // Appointment Selection View
    if (!selectedAppointment && !loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-3xl p-8 mb-8 border border-amber-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
                            <AlarmClock className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Late Arrival Help</h1>
                            <p className="text-gray-600">Running late? We've got options for you</p>
                        </div>
                    </div>
                </div>

                {/* Appointments List */}
                {appointments.length > 0 ? (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-700 px-2">
                            Select Your Appointment
                        </h2>
                        {appointments.map(apt => (
                            <button
                                key={apt.id}
                                onClick={() => checkLateStatus(apt.id)}
                                className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all text-left group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl">
                                            <Clock className="w-6 h-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800">
                                                Dr. {apt.doctor_first_name} {apt.doctor_last_name}
                                            </h3>
                                            <p className="text-gray-500">
                                                {formatTime(apt.appointment_time)} • {apt.appointment_type || 'Consultation'}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Appointments Today</h3>
                        <p className="text-gray-500 mb-6">You don't have any scheduled appointments for today</p>
                        <button
                            onClick={() => navigate('/doctors')}
                            className="px-6 py-3 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl font-medium hover:shadow-lg transition-all"
                        >
                            Book an Appointment
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Processing/Result View
    if (result) {
        const isSuccess = result.success;
        
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className={`bg-gradient-to-br ${
                    isSuccess ? 'from-green-50 via-emerald-50 to-teal-50' : 'from-red-50 via-rose-50 to-pink-50'
                } rounded-3xl p-8 text-center`}>
                    {/* Success Animation */}
                    <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${
                        isSuccess ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'
                    } animate-bounce`}>
                        {isSuccess ? (
                            <CheckCircle2 className="w-12 h-12 text-white" />
                        ) : (
                            <XCircle className="w-12 h-12 text-white" />
                        )}
                    </div>

                    <h2 className="text-2xl font-bold text-gray-800 mb-3">
                        {isSuccess ? 'All Set!' : 'Something Went Wrong'}
                    </h2>
                    <p className="text-gray-600 text-lg mb-6">{result.message}</p>

                    {/* Result Details */}
                    {result.handling === 'fit_in' && (
                        <div className="bg-white/80 rounded-2xl p-6 mb-6">
                            <div className="flex items-center justify-center gap-8">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-1">Queue Position</p>
                                    <p className="text-3xl font-bold text-blue-600">{result.queuePosition}</p>
                                </div>
                                <div className="h-12 w-px bg-gray-200" />
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-1">Est. Wait</p>
                                    <p className="text-3xl font-bold text-amber-600">{result.estimatedWaitMins} min</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {result.handling === 'end_of_session' && (
                        <div className="bg-white/80 rounded-2xl p-6 mb-6">
                            <p className="text-sm text-gray-500 mb-2">Your New Time</p>
                            <p className="text-3xl font-bold text-orange-600">
                                {formatTime(result.estimatedTime)}
                            </p>
                            <p className="text-gray-500 mt-2 text-sm">{result.note}</p>
                        </div>
                    )}

                    {result.handling === 'reschedule' && (
                        <button
                            onClick={() => navigate(`/doctors`)}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                        >
                            Book New Appointment
                        </button>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-4 mt-6">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-6 py-3 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all border border-gray-200"
                        >
                            Go to Dashboard
                        </button>
                        {(result.handling === 'fit_in' || result.handling === 'end_of_session') && (
                            <button
                                onClick={() => navigate('/live-queue')}
                                className="px-6 py-3 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl font-medium hover:shadow-lg transition-all"
                            >
                                View Live Queue
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Loading State
    if (loading) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-600">Checking your arrival status...</p>
                </div>
            </div>
        );
    }

    // Late Status View
    const statusColor = getStatusColor();
    const colorClasses = {
        green: {
            bg: 'from-green-50 to-emerald-50',
            border: 'border-green-200',
            icon: 'from-green-500 to-emerald-600',
            badge: 'bg-green-100 text-green-700'
        },
        yellow: {
            bg: 'from-yellow-50 to-amber-50',
            border: 'border-yellow-200',
            icon: 'from-yellow-500 to-amber-600',
            badge: 'bg-yellow-100 text-yellow-700'
        },
        orange: {
            bg: 'from-orange-50 to-red-50',
            border: 'border-orange-200',
            icon: 'from-orange-500 to-red-600',
            badge: 'bg-orange-100 text-orange-700'
        },
        red: {
            bg: 'from-red-50 to-rose-50',
            border: 'border-red-200',
            icon: 'from-red-500 to-rose-600',
            badge: 'bg-red-100 text-red-700'
        },
        blue: {
            bg: 'from-blue-50 to-indigo-50',
            border: 'border-blue-200',
            icon: 'from-blue-500 to-indigo-600',
            badge: 'bg-blue-100 text-blue-700'
        }
    };

    const colors = colorClasses[statusColor];

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            {/* Status Header */}
            <div className={`bg-gradient-to-br ${colors.bg} rounded-3xl p-8 border ${colors.border}`}>
                <div className="flex items-start gap-6">
                    <div className={`p-4 bg-gradient-to-br ${colors.icon} rounded-2xl shadow-lg flex-shrink-0`}>
                        {status?.isWithinGrace ? (
                            <Shield className="w-10 h-10 text-white" />
                        ) : (
                            <AlertTriangle className="w-10 h-10 text-white" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-2xl font-bold text-gray-800">
                                {status?.isWithinGrace ? 'You\'re On Time!' : 
                                 status?.canStillBeAccommodated ? 'Running a Bit Late' :
                                 status?.shouldAutoReschedule ? 'Significantly Late' : 'Very Late'}
                            </h1>
                            <span className={`px-3 py-1 ${colors.badge} rounded-full text-sm font-medium`}>
                                {status?.minutesLate > 0 ? `${status.minutesLate} min late` : 'On time'}
                            </span>
                        </div>
                        <p className="text-gray-600">
                            {status?.isWithinGrace ? 
                                'You\'re within the grace period. Proceed to check-in normally.' :
                             status?.canStillBeAccommodated ?
                                'Don\'t worry! We can still accommodate you with the options below.' :
                             status?.shouldAutoReschedule ?
                                'We recommend rescheduling your appointment for another day.' :
                                'Please choose an option below to proceed.'}
                        </p>
                    </div>
                </div>

                {/* Time Info */}
                <div className="mt-6 grid grid-cols-3 gap-4">
                    <div className="bg-white/60 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Scheduled Time</p>
                        <p className="text-lg font-bold text-gray-800">
                            {status?.appointmentTime ? new Date(status.appointmentTime).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                            }) : '--'}
                        </p>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Current Time</p>
                        <p className="text-lg font-bold text-gray-800">
                            {new Date().toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                            })}
                        </p>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Grace Period</p>
                        <p className="text-lg font-bold text-gray-800">
                            {status?.policy?.gracePeriodMins || 10} min
                        </p>
                    </div>
                </div>
            </div>

            {/* Options */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Available Options
                </h2>

                <div className="space-y-4">
                    {status?.options?.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleOptionSelect(option.id)}
                            disabled={processing}
                            className={`w-full p-5 rounded-2xl border-2 transition-all text-left group relative overflow-hidden ${
                                selectedOption === option.id 
                                    ? 'border-primary bg-primary/5'
                                    : option.recommended 
                                        ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 hover:border-green-400'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {option.recommended && (
                                <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-medium rounded-bl-xl">
                                    Recommended
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <div className={`p-3 bg-gradient-to-br ${getOptionColor(option.id, option.recommended)} rounded-xl text-white flex-shrink-0`}>
                                    {getOptionIcon(option.id)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-800 text-lg">{option.label}</h3>
                                    <p className="text-gray-500 text-sm">{option.description}</p>
                                    {option.estimatedWaitMins && (
                                        <p className="text-amber-600 text-sm mt-1 font-medium">
                                            ~{option.estimatedWaitMins} min wait
                                        </p>
                                    )}
                                </div>
                                <ArrowRight className={`w-5 h-5 transition-all ${
                                    option.recommended ? 'text-green-500' : 'text-gray-400'
                                } group-hover:translate-x-1`} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Policy Info */}
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-100">
                <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-gray-500" />
                    Late Arrival Policy
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">Grace Period</p>
                        <p className="font-medium text-gray-700">{status?.policy?.gracePeriodMins || 10} minutes</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Max Late Accommodation</p>
                        <p className="font-medium text-gray-700">{status?.policy?.maxLateMins || 30} minutes</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Fit-In Available</p>
                        <p className="font-medium text-gray-700">{status?.policy?.allowFitIn ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Auto-Reschedule After</p>
                        <p className="font-medium text-gray-700">{status?.policy?.autoRescheduleAfterMins || 45} minutes</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LateArrival;
