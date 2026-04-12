import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import PeakHoursAnalytics from '../components/PeakHoursAnalytics';
import { BarChart3, Clock, TrendingUp, Sparkles, ShieldCheck } from 'lucide-react';

const DoctorAnalytics = () => {
    const { user } = useAuth();

    if (!user || user.role !== 'DOCTOR') {
        return <div className="p-20 text-center text-rose-500 font-black tracking-widest uppercase animate-pulse">Access Protocol Denied</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20 px-4 md:px-0 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b border-[var(--border-base)]">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-primary shadow-xl shadow-primary/20 flex items-center justify-center text-white">
                            <BarChart3 size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic">Intelligence</h1>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Clinical performance engine • Active</p>
                        </div>
                    </div>
                    <p className="text-slate-500 font-bold max-w-lg leading-relaxed">
                        Decrypting complex clinical workflows into actionable professional insights. Optimize your practice with real-time patient engagement data.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-6 py-2 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20 flex items-center gap-3 shadow-inner">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(79,70,229,1)]"></span>
                        Neural Analysis Sync Activeing
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
                {/* Advanced Peak Hours Component */}
                <div className="glass-card p-1">
                    <PeakHoursAnalytics doctorId={user.id} />
                </div>
                
                {/* Future Module Teaser */}
                <div className="glass-card p-12 relative overflow-hidden group border-primary/5">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[80px] -z-10 -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-1000"></div>
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-[60px] -z-10 translate-y-1/2 -translate-x-1/2"></div>
                    
                    <div className="flex flex-col items-center text-center space-y-8 max-w-xl mx-auto py-10">
                        <div className="relative">
                            <div className="w-24 h-24 bg-white/5 dark:bg-primary/20 rounded-[3rem] flex items-center justify-center text-primary group-hover:scale-110 transition-all duration-700 shadow-inner border border-primary/10">
                                <Sparkles size={40} strokeWidth={1.5} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-12 group-hover:rotate-0 transition-transform">
                                <ShieldCheck size={20} />
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <h2 className="text-3xl font-black text-[var(--text-base)] uppercase tracking-tight italic">Predictive Retention Engine</h2>
                            <p className="text-sm font-bold text-slate-500 leading-relaxed">
                                Our clinical intelligence team is finalizing an advanced AI module for longitudinal patient outcome tracking and churn prediction. This module will integrate semantic analysis from patient feedback into your key performance indicators.
                            </p>
                        </div>
                        
                        <div className="pt-4 flex flex-wrap justify-center gap-4">
                            <span className="px-5 py-2 glass-card bg-primary/5 text-primary rounded-xl font-black text-[10px] uppercase tracking-widest border-primary/10 select-none">
                                Churn Prediction
                            </span>
                            <span className="px-5 py-2 glass-card bg-primary/5 text-primary rounded-xl font-black text-[10px] uppercase tracking-widest border-primary/10 select-none opacity-60">
                                Sentiment Core
                            </span>
                            <span className="px-5 py-2 glass-card bg-primary/5 text-primary rounded-xl font-black text-[10px] uppercase tracking-widest border-primary/10 select-none opacity-40">
                                Longitudinal Outcomes
                            </span>
                        </div>
                        
                        <div className="pt-6">
                            <div className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 transition-all cursor-wait">
                                Decoding Modules... 84%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorAnalytics;
