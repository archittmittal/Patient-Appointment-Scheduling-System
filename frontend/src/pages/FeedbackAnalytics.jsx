/**
 * Feedback Analytics - PREMIUM OVERHAUL
 * Two distinct high-fidelity experiences for Patients and Practitioners.
 */

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
    Award,
    Activity,
    Zap,
    MoveRight,
    Search,
    ShieldCheck
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
        'Shorter wait times', 'Better communication', 'Cleaner facilities', 
        'Easier booking', 'More slots', 'Better parking', 
        'Staff training', 'Online options'
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

            const initialRatings = {};
            catRes.data.forEach(cat => { initialRatings[cat.id] = 0; });
            setRatings(initialRatings);

            if (user?.role === 'DOCTOR') {
                const analyticsRes = await API.get('/feedback/doctor-analytics');
                setAnalytics(analyticsRes.data);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleRatingChange = (categoryId, value) => {
        setRatings(prev => ({ ...prev, [categoryId]: value }));
    };

    const toggleImprovement = (item) => {
        setImprovements(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item] );
    };

    const handleSubmit = async () => {
        if (!selectedAppointment) return;
        setSubmitting(true);
        try {
            await API.post('/feedback/submit', {
                appointmentId: selectedAppointment.id,
                ratings, comment, wouldRecommend, improvements
            });
            setSubmitted(true);
            setTimeout(() => {
                setSubmitted(false);
                setSelectedAppointment(null);
                setComment('');
                setWouldRecommend(true);
                setImprovements([]);
                loadInitialData();
            }, 2500);
        } catch (err) { console.error(err); } finally { setSubmitting(false); }
    };

    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    };

    if (submitted) {
        return (
            <div className="max-w-2xl mx-auto p-10 animate-in zoom-in-95 duration-700">
                <div className="glass-modal rounded-[3.5rem] p-16 text-center border-none relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-500/30 animate-bounce">
                        <CheckCircle2 size={48} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic mb-4">Packet Transmitted</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10 italic">Your telemetry feed has been synchronized with the clinical registry.</p>
                    <div className="flex justify-center gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-2 h-2 rounded-full bg-emerald-500/40 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (loading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse">Synchronizing Sentiment Matrix...</div>;

    // Practicioner Analytics View
    if (user?.role === 'DOCTOR') {
        return (
            <div className="max-w-6xl mx-auto space-y-10 pb-20 px-4 md:px-0 animate-in fade-in duration-700">
                {/* Header */}
                <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                            <BarChart3 size={32} strokeWidth={2.5} />
                        </div>
                        <div className="text-center md:text-left">
                            <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none mb-4">Sentiment Pulse</h1>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic">Real-time longitudinal patient satisfaction telemetry</p>
                        </div>
                    </div>
                </div>

                {/* Status Nodes */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatusNode icon={Star} label="Rating Index" value={analytics?.overall?.avgScore || '0'} sub="/ 5.0 Precision" color="amber" />
                    <StatusNode icon={MessageSquare} label="Registry Logs" value={analytics?.overall?.totalReviews || 0} sub="Cumulative Feed" color="primary" />
                    <StatusNode icon={ThumbsUp} label="Advocacy Rate" value={`${analytics?.overall?.recommendRate || 0}%`} sub="Promoter Verified" color="emerald" />
                    <StatusNode icon={Heart} label="Neural Sentiment" value={`${((analytics?.overall?.avgSentiment || 0.5) * 100).toFixed(0)}%`} sub="Positive Vectors" color="rose" />
                </div>

                {/* Matrix Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 glass-card rounded-[3.5rem] p-10 border-[var(--border-base)] relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={64} /></div>
                        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-10 italic">Category Dimensionality Matrix</h2>
                        <div className="space-y-10">
                            {analytics?.categoryBreakdown?.map(cat => (
                                <div key={cat.category} className="space-y-4">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest italic leading-none">
                                        <span className="text-slate-400">{cat.label}</span>
                                        <span className="text-primary">{cat.avgScore} / 5</span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 shadow-lg ${
                                                parseFloat(cat.avgScore) >= 4 ? 'bg-emerald-500 shadow-emerald-500/20' :
                                                parseFloat(cat.avgScore) >= 3 ? 'bg-amber-500 shadow-amber-500/20' :
                                                'bg-rose-500 shadow-rose-500/20'
                                            }`}
                                            style={{ width: `${(parseFloat(cat.avgScore) / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-10">
                        {/* Optimization Suggestions */}
                        <div className="glass-card rounded-[3.5rem] p-10 border-[var(--border-base)] h-full relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={48} /></div>
                            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-10 italic">Calibration Needs</h2>
                            <div className="space-y-4">
                                {analytics?.topImprovements?.map((imp, idx) => (
                                    <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group/item hover:bg-white/10 transition-all">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-none">{imp.item}</span>
                                        <span className="text-[10px] font-black text-primary uppercase italic tabular-nums bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">+{imp.count} Logs</span>
                                    </div>
                                ))}
                                {(!analytics?.topImprovements || analytics.topImprovements.length === 0) && (
                                    <div className="py-10 text-center space-y-4">
                                         <ShieldCheck size={32} className="text-emerald-500/20 mx-auto" />
                                         <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic leading-relaxed">System performance optimal.<br/>No critical calibration anomalies detected.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Patient Service Calibration View
    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20 px-4 md:px-0 animate-in fade-in duration-700">
            {/* Header */}
            <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10 text-center md:text-left">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                        <MessageSquare size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none mb-4">Service Calibration</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic">Collaborative clinical experience optimization</p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="glass-card rounded-[2.5rem] p-2 border-[var(--border-base)] flex gap-2">
                <TabButton 
                    active={activeTab === 'submit'} 
                    onClick={() => setActiveTab('submit')} 
                    icon={Send}
                    label="Transmit Feed"
                    badge={pendingFeedback.length}
                />
                <TabButton 
                    active={activeTab === 'history'} 
                    onClick={() => setActiveTab('history')} 
                    icon={Clock}
                    label="Historical Logs"
                />
            </div>

            {/* Submit Sector */}
            {activeTab === 'submit' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                    {!selectedAppointment ? (
                        <div className="grid grid-cols-1 gap-4">
                            {pendingFeedback.length > 0 ? (
                                pendingFeedback.map(apt => (
                                    <button
                                        key={apt.id}
                                        onClick={() => setSelectedAppointment(apt)}
                                        className="w-full glass-card p-8 rounded-[3rem] border-[var(--border-base)] hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-700 text-left relative overflow-hidden group"
                                    >
                                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={48} /></div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-primary shadow-inner group-hover:scale-110 transition-transform">
                                                    <Stethoscope size={24} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-[var(--text-base)] uppercase italic tracking-tight">Cycle with Dr. {apt.doctor_name}</h3>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2 italic">
                                                        {apt.specialty || 'Clinical'} • {formatDate(apt.appointment_date)} at {formatTime(apt.appointment_time)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-primary transition-all group-hover:translate-x-1">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="py-24 text-center glass-modal rounded-[3.5rem] border-none">
                                    <CheckCircle2 size={64} className="text-emerald-500/20 mx-auto mb-6" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic opacity-60">System Synchronized.<br/>All clinical cycles have been calibrated.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Submission GUI */
                        <div className="glass-modal rounded-[3.5rem] border-none shadow-2xl overflow-hidden animate-in zoom-in-95 duration-700">
                             <div className="bg-primary p-10 relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-10 opacity-10"><Zap size={80} /></div>
                                 <button onClick={() => setSelectedAppointment(null)} className="text-white/60 hover:text-white transition-all text-[9px] font-black uppercase tracking-[0.3em] italic mb-6 flex items-center gap-2">
                                     <ArrowRight size={14} className="rotate-180" /> Abort Configuration
                                 </button>
                                 <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Cycle Calibration</h2>
                                 <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] mt-3 italic">
                                     Recipient: Dr. {selectedAppointment.doctor_name} • ID {selectedAppointment.id}
                                 </p>
                             </div>

                             <div className="p-10 space-y-12">
                                 {/* Ratings Cluster */}
                                 <div className="space-y-6">
                                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Primary Metrix</h3>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         {categories.map(cat => (
                                             <div key={cat.id} className="p-6 bg-white/5 border border-white/5 rounded-[2rem] flex flex-col gap-4 items-center group/cat hover:bg-white/10 transition-all">
                                                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">{cat.label}</span>
                                                 <StarGauge 
                                                     value={ratings[cat.id] || 0}
                                                     onChange={(val) => handleRatingChange(cat.id, val)}
                                                 />
                                             </div>
                                         ))}
                                     </div>
                                 </div>

                                 {/* Advocacy Index */}
                                 <div className="space-y-6">
                                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Advocacy Vectors</h3>
                                     <div className="flex gap-4">
                                         <AdvocacyButton active={wouldRecommend} onClick={() => setWouldRecommend(true)} label="Positive Propagation" icon={ThumbsUp} color="emerald" />
                                         <AdvocacyButton active={!wouldRecommend} onClick={() => setWouldRecommend(false)} label="Negative Feed" icon={ThumbsDown} color="rose" />
                                     </div>
                                 </div>

                                 {/* Refinement Blocks */}
                                 <div className="space-y-6">
                                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Recommended Refinements</h3>
                                     <div className="flex flex-wrap gap-3">
                                         {improvementOptions.map(item => (
                                             <button
                                                 key={item}
                                                 onClick={() => toggleImprovement(item)}
                                                 className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all italic border ${
                                                     improvements.includes(item)
                                                         ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20'
                                                         : 'bg-white/5 text-slate-500 border-white/10 hover:border-white/20'
                                                 }`}
                                             >
                                                 {item}
                                             </button>
                                         ))}
                                     </div>
                                 </div>

                                 {/* Narrative Buffer */}
                                 <div className="space-y-6">
                                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Nuance Buffer (Optional)</h3>
                                     <textarea
                                         value={comment}
                                         onChange={(e) => setComment(e.target.value)}
                                         placeholder="Enter descriptive observations for LLM analysis..."
                                         className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.5rem] text-sm font-bold text-[var(--text-base)] italic focus:outline-none focus:border-primary/40 focus:bg-white/10 transition-all shadow-inner h-32 resize-none uppercase tracking-wider"
                                     />
                                 </div>
                             </div>

                             <div className="p-10 border-t border-white/10 bg-white/5 flex justify-end">
                                 <button
                                     onClick={handleSubmit}
                                     disabled={submitting || Object.values(ratings).every(r => r === 0)}
                                     className={`px-12 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] italic flex items-center justify-center gap-4 transition-all ${
                                         submitting || Object.values(ratings).every(r => r === 0)
                                             ? 'bg-white/5 border border-white/10 text-slate-700 cursor-not-allowed'
                                             : 'bg-primary text-white shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1'
                                     }`}
                                 >
                                     {submitting ? 'Transmitting Neural Feed...' : <><Send size={18} /> Broadcast Matrix</>}
                                 </button>
                             </div>
                        </div>
                    )}
                </div>
            )}

            {/* History Sector */}
            {activeTab === 'history' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                    {feedbackHistory.length > 0 ? (
                        feedbackHistory.map(fb => (
                            <div key={fb.id} className="glass-card p-10 rounded-[3.5rem] border-[var(--border-base)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={64} /></div>
                                <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 mb-10 relative z-10">
                                    <div className="text-center md:text-left">
                                        <h3 className="text-2xl font-black text-[var(--text-base)] uppercase italic tracking-tighter mb-2">Cycle Entry #{fb.id}</h3>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">
                                            Dr. {fb.doctor_name} • {fb.specialty} • {formatDate(fb.appointment_date)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 px-6 py-3 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] shadow-inner">
                                        <Star className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
                                        <span className="text-xl font-black text-amber-600 italic tabular-nums">{fb.weighted_score?.toFixed(1)}</span>
                                        <span className="text-[9px] font-black text-amber-600/40 uppercase tracking-widest">Precision Score</span>
                                    </div>
                                </div>

                                {/* Composite Metrics */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 relative z-10 px-2">
                                    {Object.entries(fb.ratings || {}).map(([key, value]) => (
                                        <div key={key} className="p-5 bg-white/5 border border-white/5 rounded-[2.5rem] text-center border-b-4 border-b-primary/40 group/m hover:bg-white/10 transition-all">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic mb-3">
                                                {categories.find(c => c.id === key)?.label || 'System Node'}
                                            </p>
                                            <div className="flex justify-center gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} className={`w-3.5 h-3.5 ${i < value ? 'fill-primary text-primary' : 'text-white/10'} transition-transform group-hover/m:scale-110`} style={{ transitionDelay: `${i * 0.05}s` }} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {fb.comment && (
                                    <div className="relative p-6 bg-white/5 rounded-[2rem] border-l-4 border-l-primary/20 italic mb-8">
                                         <MessageSquare className="absolute top-4 right-6 opacity-5" size={32} />
                                         <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest opacity-80 decoration-primary/20 underline-offset-4 decoration-dotted">"{fb.comment}"</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 pt-10 border-t border-white/10 opacity-60">
                                    {fb.would_recommend ? (
                                        <div className="flex items-center gap-3 text-emerald-500 text-[9px] font-black uppercase tracking-[0.2em] italic">
                                            <div className="p-2 bg-emerald-500/10 rounded-lg"><ThumbsUp size={14} /></div> Propagation Flag: Set
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 text-rose-500 text-[9px] font-black uppercase tracking-[0.2em] italic">
                                            <div className="p-2 bg-rose-500/10 rounded-lg"><ThumbsDown size={14} /></div> Propagation Flag: Reset
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-24 text-center glass-modal rounded-[3.5rem] border-none">
                            <Clock size={64} className="text-slate-500/20 mx-auto mb-6" />
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic leading-relaxed">Historical registry empty.<br/>No longitudinal telemetry patterns detected.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Internal Components
const StatusNode = ({ icon: Icon, label, value, sub, color }) => (
    <div className="glass-card p-8 rounded-[3rem] border-[var(--border-base)] group hover:border-white/10 transition-all duration-700 relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity ${`text-${color}-500`}`}><Icon size={48} /></div>
        <div className="flex items-center gap-4 mb-8">
            <div className={`p-4 bg-${color}-500/10 text-${color}-500 rounded-2xl border border-${color}-500/20 shadow-inner group-hover:rotate-12 transition-transform duration-700`}>
                <Icon size={24} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">{label}</span>
        </div>
        <div className="space-y-2">
            <div className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic tabular-nums">{value}</div>
            <p className={`text-[9px] font-black text-${color}-500 uppercase tracking-widest italic opacity-60`}>{sub}</p>
        </div>
    </div>
);

const TabButton = ({ active, onClick, icon: Icon, label, badge }) => (
    <button
        onClick={onClick}
        className={`flex-1 py-4 px-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] italic transition-all duration-700 flex items-center justify-center gap-3 relative overflow-hidden ${
            active 
                ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
        }`}
    >
        <Icon size={16} />
        {label}
        {badge > 0 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-[8px] rounded-lg animate-pulse">
                {badge}
            </span>
        )}
    </button>
);

const StarGauge = ({ value, onChange }) => (
    <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(star => (
            <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                className="transition-all hover:scale-125 hover:-translate-y-1 active:scale-95 group/star"
            >
                <Star
                    size={28}
                    strokeWidth={2.5}
                    className={`${
                        star <= value 
                            ? 'fill-amber-500 text-amber-500 shadow-amber-500/20 filter drop-shadow-lg' 
                            : 'text-slate-700 group-hover/star:text-slate-500'
                    } transition-all duration-500`}
                />
            </button>
        ))}
    </div>
);

const AdvocacyButton = ({ active, onClick, label, icon: Icon, color }) => (
    <button
        onClick={onClick}
        className={`flex-1 p-8 rounded-[3rem] border-2 transition-all duration-700 flex flex-col items-center gap-4 group ${
            active 
                ? `border-${color}-500/40 bg-${color}-500/10 shadow-2xl shadow-${color}-500/5` 
                : 'border-white/5 bg-white/5 hover:border-white/20'
        }`}
    >
        <div className={`p-5 rounded-2xl transition-all duration-700 ${active ? `bg-${color}-500 text-white shadow-xl shadow-${color}-500/20` : 'bg-white/5 text-slate-700 group-hover:text-slate-500'}`}>
            <Icon size={28} strokeWidth={2.5} />
        </div>
        <span className={`text-[10px] font-black uppercase tracking-[0.3em] italic transition-colors ${active ? `text-${color}-500` : 'text-slate-600'}`}>
            {label}
        </span>
    </button>
);

export default FeedbackAnalytics;
