import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';
import { 
    Star, 
    MessageSquare, 
    ThumbsUp, 
    ThumbsDown,
    Send,
    CheckCircle2,
    Clock,
    User,
    Stethoscope,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Sparkles,
    Heart,
    AlertCircle,
    ChevronRight,
    Calendar,
    Award
} from 'lucide-react';

const FeedbackAnalytics = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('submit');
    const [pendingFeedback, setPendingFeedback] = useState([]);
    const [feedbackHistory, setFeedbackHistory] = useState([]);
    const [categories, setCategories] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form state
    const [ratings, setRatings] = useState({});
    const [comment, setComment] = useState('');
    const [wouldRecommend, setWouldRecommend] = useState(true);
    const [improvements, setImprovements] = useState([]);

    const improvementOptions = [
        'Shorter wait times',
        'Better communication',
        'Cleaner facilities',
        'Easier booking',
        'More appointment slots',
        'Better parking',
        'Staff training',
        'Online consultations'
    ];

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [catRes, pendingRes, historyRes] = await Promise.all([
                API.get('/feedback/categories'),
                user?.role === 'PATIENT' ? API.get('/feedback/pending') : Promise.resolve({ data: [] }),
                user?.role === 'PATIENT' ? API.get('/feedback/history') : Promise.resolve({ data: [] })
            ]);

            setCategories(catRes.data);
            setPendingFeedback(pendingRes.data);
            setFeedbackHistory(historyRes.data);

            // Initialize ratings
            const initialRatings = {};
            catRes.data.forEach(cat => {
                initialRatings[cat.id] = 0;
            });
            setRatings(initialRatings);

            // Load analytics if doctor
            if (user?.role === 'DOCTOR') {
                const analyticsRes = await API.get('/feedback/doctor-analytics');
                setAnalytics(analyticsRes.data);
            }
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRatingChange = (categoryId, value) => {
        setRatings(prev => ({ ...prev, [categoryId]: value }));
    };

    const toggleImprovement = (item) => {
        setImprovements(prev => 
            prev.includes(item) 
                ? prev.filter(i => i !== item)
                : [...prev, item]
        );
    };

    const handleSubmit = async () => {
        if (!selectedAppointment) return;

        setSubmitting(true);
        try {
            await API.post('/feedback/submit', {
                appointmentId: selectedAppointment.id,
                ratings,
                comment,
                wouldRecommend,
                improvements
            });
            setSubmitted(true);
            
            // Refresh data
            setTimeout(() => {
                setSubmitted(false);
                setSelectedAppointment(null);
                setComment('');
                setWouldRecommend(true);
                setImprovements([]);
                loadInitialData();
            }, 2000);
        } catch (err) {
            console.error('Submit error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        return `${h > 12 ? h - 12 : h}:${minutes} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    // Star Rating Component
    const StarRating = ({ value, onChange, size = 'md' }) => {
        const sizeClasses = {
            sm: 'w-5 h-5',
            md: 'w-7 h-7',
            lg: 'w-8 h-8'
        };

        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        className="transition-transform hover:scale-110"
                    >
                        <Star
                            className={`${sizeClasses[size]} ${
                                star <= value 
                                    ? 'fill-amber-400 text-amber-400' 
                                    : 'text-gray-300'
                            }`}
                        />
                    </button>
                ))}
            </div>
        );
    };

    // Success Animation
    if (submitted) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-3xl p-12 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <CheckCircle2 className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h2>
                    <p className="text-gray-600">Your feedback helps us improve our services.</p>
                    <div className="flex justify-center gap-2 mt-6">
                        {[...Array(5)].map((_, i) => (
                            <Sparkles key={i} className="w-6 h-6 text-amber-400 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Loading State
    if (loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-600">Loading feedback data...</p>
                </div>
            </div>
        );
    }

    // Doctor Analytics View
    if (user?.role === 'DOCTOR') {
        return (
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-3xl p-8 border border-purple-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg">
                            <BarChart3 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Feedback Analytics</h1>
                            <p className="text-gray-600">See how patients rate your services</p>
                        </div>
                    </div>
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <Star className="w-5 h-5 text-amber-600 fill-amber-600" />
                            </div>
                            <span className="text-gray-600 text-sm">Avg Rating</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {analytics?.overall?.avgScore || '0'}
                            <span className="text-lg text-gray-400">/5</span>
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-gray-600 text-sm">Total Reviews</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{analytics?.overall?.totalReviews || 0}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <ThumbsUp className="w-5 h-5 text-green-600" />
                            </div>
                            <span className="text-gray-600 text-sm">Would Recommend</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">{analytics?.overall?.recommendRate || 0}%</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Heart className="w-5 h-5 text-purple-600" />
                            </div>
                            <span className="text-gray-600 text-sm">Sentiment</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-800">
                            {((analytics?.overall?.avgSentiment || 0.5) * 100).toFixed(0)}%
                        </p>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800 mb-6">Category Breakdown</h2>
                    <div className="space-y-4">
                        {analytics?.categoryBreakdown?.map(cat => (
                            <div key={cat.category} className="flex items-center gap-4">
                                <div className="w-40 text-sm text-gray-600">{cat.label}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            parseFloat(cat.avgScore) >= 4 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                                            parseFloat(cat.avgScore) >= 3 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                                            'bg-gradient-to-r from-red-400 to-rose-500'
                                        }`}
                                        style={{ width: `${(parseFloat(cat.avgScore) / 5) * 100}%` }}
                                    />
                                </div>
                                <div className="w-16 text-right font-semibold text-gray-800">
                                    {cat.avgScore}/5
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Improvement Suggestions */}
                {analytics?.topImprovements?.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            Top Improvement Areas
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {analytics.topImprovements.map((imp, idx) => (
                                <div 
                                    key={idx}
                                    className="px-4 py-2 bg-white rounded-xl border border-amber-200 text-sm"
                                >
                                    <span className="font-medium text-gray-700">{imp.item}</span>
                                    <span className="ml-2 text-amber-600">({imp.count})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Patient View
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-3xl p-8 border border-purple-100">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg">
                        <MessageSquare className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Share Your Feedback</h1>
                        <p className="text-gray-600">Help us improve your healthcare experience</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 flex gap-2">
                <button
                    onClick={() => setActiveTab('submit')}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                        activeTab === 'submit' 
                            ? 'bg-primary text-white' 
                            : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    Submit Feedback
                    {pendingFeedback.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                            {pendingFeedback.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                        activeTab === 'history' 
                            ? 'bg-primary text-white' 
                            : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    My Feedback History
                </button>
            </div>

            {/* Submit Tab */}
            {activeTab === 'submit' && (
                <>
                    {/* Pending Feedback List */}
                    {!selectedAppointment && (
                        <div className="space-y-4">
                            {pendingFeedback.length > 0 ? (
                                <>
                                    <p className="text-gray-600 px-2">Select an appointment to rate:</p>
                                    {pendingFeedback.map(apt => (
                                        <button
                                            key={apt.id}
                                            onClick={() => setSelectedAppointment(apt)}
                                            className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all text-left group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-gradient-to-br from-purple-100 to-violet-100 rounded-xl">
                                                        <Stethoscope className="w-6 h-6 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-800">
                                                            Dr. {apt.doctor_name}
                                                        </h3>
                                                        <p className="text-gray-500 text-sm">
                                                            {apt.specialty || 'General'} • {formatDate(apt.appointment_date)} at {formatTime(apt.appointment_time)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-700 mb-2">All Caught Up!</h3>
                                    <p className="text-gray-500">You've rated all your recent appointments</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Feedback Form */}
                    {selectedAppointment && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            {/* Appointment Header */}
                            <div className="bg-gradient-to-r from-purple-500 to-violet-600 p-6 text-white">
                                <button
                                    onClick={() => setSelectedAppointment(null)}
                                    className="text-white/80 hover:text-white text-sm mb-2 flex items-center gap-1"
                                >
                                    ← Back to list
                                </button>
                                <h2 className="text-xl font-bold">Rate Your Visit</h2>
                                <p className="text-white/80">
                                    Dr. {selectedAppointment.doctor_name} • {formatDate(selectedAppointment.appointment_date)}
                                </p>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Category Ratings */}
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-800">How would you rate:</h3>
                                    {categories.map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                                            <span className="text-gray-700">{cat.label}</span>
                                            <StarRating 
                                                value={ratings[cat.id] || 0}
                                                onChange={(val) => handleRatingChange(cat.id, val)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Would Recommend */}
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-3">Would you recommend this doctor?</h3>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setWouldRecommend(true)}
                                            className={`flex-1 py-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                                                wouldRecommend 
                                                    ? 'border-green-500 bg-green-50 text-green-700' 
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                        >
                                            <ThumbsUp className="w-5 h-5" />
                                            Yes
                                        </button>
                                        <button
                                            onClick={() => setWouldRecommend(false)}
                                            className={`flex-1 py-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                                                !wouldRecommend 
                                                    ? 'border-red-500 bg-red-50 text-red-700' 
                                                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                        >
                                            <ThumbsDown className="w-5 h-5" />
                                            No
                                        </button>
                                    </div>
                                </div>

                                {/* Improvements */}
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-3">What could be improved?</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {improvementOptions.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleImprovement(item)}
                                                className={`px-4 py-2 rounded-full text-sm transition-all ${
                                                    improvements.includes(item)
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Comment */}
                                <div>
                                    <h3 className="font-semibold text-gray-800 mb-3">Additional comments (optional)</h3>
                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Share your experience..."
                                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-32"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || Object.values(ratings).every(r => r === 0)}
                                    className={`w-full py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                                        submitting || Object.values(ratings).every(r => r === 0)
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:shadow-lg'
                                    }`}
                                >
                                    {submitting ? (
                                        <>
                                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Submit Feedback
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {feedbackHistory.length > 0 ? (
                        feedbackHistory.map(fb => (
                            <div key={fb.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Dr. {fb.doctor_name}</h3>
                                        <p className="text-gray-500 text-sm">
                                            {fb.specialty} • {formatDate(fb.appointment_date)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 px-3 py-1 bg-amber-100 rounded-full">
                                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                        <span className="font-semibold text-amber-700">{fb.weighted_score?.toFixed(1)}</span>
                                    </div>
                                </div>

                                {/* Ratings */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    {Object.entries(fb.ratings || {}).map(([key, value]) => (
                                        <div key={key} className="bg-gray-50 rounded-lg p-3 text-center">
                                            <p className="text-xs text-gray-500 mb-1">
                                                {categories.find(c => c.id === key)?.label || key}
                                            </p>
                                            <div className="flex justify-center">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star 
                                                        key={i} 
                                                        className={`w-4 h-4 ${i < value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {fb.comment && (
                                    <p className="text-gray-600 text-sm italic">"{fb.comment}"</p>
                                )}

                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                    {fb.would_recommend ? (
                                        <span className="flex items-center gap-1 text-green-600 text-sm">
                                            <ThumbsUp className="w-4 h-4" /> Would recommend
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-red-600 text-sm">
                                            <ThumbsDown className="w-4 h-4" /> Would not recommend
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-10 h-10 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Feedback Yet</h3>
                            <p className="text-gray-500">Your submitted feedback will appear here</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FeedbackAnalytics;
