import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { AlertTriangle, UserMinus, TrendingDown, Info, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

const PredictiveAnalytics = ({ doctorId }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get(`/api/analytics/doctor/${doctorId}/predictive`);
            if (data.error) throw new Error(data.error);
            setData(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching predictive analytics:', err);
            setError('Failed to sync intelligence modules. Please retry.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (doctorId) {
            fetchData();
        }
    }, [doctorId]);

    if (loading) {
        return (
            <div className="p-20 text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto shadow-lg shadow-primary/10"></div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] animate-pulse">Running Neural Inference...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-12 text-center glass-card border-rose-500/20 bg-rose-500/5">
                <ShieldAlert className="mx-auto text-rose-500 mb-4" size={40} />
                <p className="text-rose-500 font-bold mb-6">{error}</p>
                <button 
                    onClick={fetchData}
                    className="px-8 py-3 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center gap-2 mx-auto"
                >
                    <RefreshCw size={14} /> Retry Sync
                </button>
            </div>
        );
    }

    const { highRiskNoShows = [], highRiskChurn = [] } = data || {};

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* No-Show Risk Module */}
                <div className="glass-card p-10 relative group overflow-hidden border-amber-500/10 hover:border-amber-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="flex items-center justify-between mb-10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="text-amber-500" size={24} />
                                <h3 className="text-2xl font-black text-[var(--text-base)] uppercase italic tracking-tight">No-Show Vectors</h3>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Appointment Reliability Scan</p>
                        </div>
                        <div className="px-4 py-1.5 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                            {highRiskNoShows.length} Alerts
                        </div>
                    </div>

                    {highRiskNoShows.length > 0 ? (
                        <div className="space-y-6">
                            {highRiskNoShows.map((risk, index) => (
                                <div key={index} className="p-6 rounded-3xl bg-white/5 dark:bg-black/20 border border-white/10 group-hover:bg-amber-500/[0.02] transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Appointment ID: {risk.appointmentId}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                                <p className="font-bold text-[var(--text-base)]">{Math.round(risk.probability * 100)}% Miss Probability</p>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter ${
                                            risk.riskLevel === 'HIGH' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                                        }`}>
                                            {risk.riskLevel} Risk
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {risk.factors.map((factor, fIdx) => (
                                            <span key={fIdx} className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-slate-400 border border-white/5">
                                                {factor}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div className="pt-4">
                                <button className="w-full py-4 glass-card bg-amber-500/10 text-amber-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-3">
                                    Trigger Auto-Reminders <Sparkles size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 text-center space-y-4">
                            <ShieldAlert className="mx-auto text-slate-300 dark:text-slate-700" size={48} />
                            <p className="text-xs font-bold text-slate-400">All upcoming appointments showing nominal reliability vectors.</p>
                        </div>
                    )}
                </div>

                {/* Churn Risk Module */}
                <div className="glass-card p-10 relative group overflow-hidden border-rose-500/10 hover:border-rose-500/30 transition-all duration-500">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="flex items-center justify-between mb-10">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <UserMinus className="text-rose-500" size={24} />
                                <h3 className="text-2xl font-black text-[var(--text-base)] uppercase italic tracking-tight">Churn Analysis</h3>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Retention Engine</p>
                        </div>
                        <div className="px-4 py-1.5 bg-rose-500/10 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-500/20">
                            {highRiskChurn.length} High Risk
                        </div>
                    </div>

                    {highRiskChurn.length > 0 ? (
                        <div className="space-y-6">
                            {highRiskChurn.map((risk, index) => (
                                <div key={index} className="p-6 rounded-3xl bg-white/5 dark:bg-black/20 border border-white/10 group-hover:bg-rose-500/[0.02] transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Patient ID: {risk.patientId}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                                <p className="font-bold text-[var(--text-base)]">{Math.round(risk.probability * 100)}% Attrition Risk</p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 bg-rose-500 text-white rounded-lg text-[8px] font-black uppercase tracking-tighter">
                                            {risk.riskLevel} Risk
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {risk.factors.map((factor, fIdx) => (
                                            <span key={fIdx} className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-slate-400 border border-white/5">
                                                {factor}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div className="pt-4">
                                <button className="w-full py-4 glass-card bg-rose-500/10 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center justify-center gap-3">
                                    Initiate Retention Protocol <TrendingDown size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 text-center space-y-4">
                            <ShieldAlert className="mx-auto text-slate-300 dark:text-slate-700" size={48} />
                            <p className="text-xs font-bold text-slate-400">Patient retention metrics are within optimal range.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Prediction Logic Transparency */}
            <div className="glass-card p-10 bg-gradient-to-br from-primary/[0.03] to-indigo-500/[0.03] border-primary/10">
                <div className="flex items-center gap-4 mb-6">
                    <Info className="text-primary" size={20} />
                    <h4 className="text-lg font-black text-[var(--text-base)] uppercase italic tracking-tight">Intelligence Methodology</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">No-Show Vectors</p>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                            Calculated using lead-time deltas, historical non-attendance logs, and seasonal slot variations.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Churn Probabilities</p>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                            Derived from visit recency, satisfaction sentiment scores, and follow-up compliance rates.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence Interval</p>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                            Model current accuracy estimated at ~84% based on historical validation datasets.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PredictiveAnalytics;
