import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import PeakHoursAnalytics from '../components/PeakHoursAnalytics';
import PredictiveAnalytics from '../components/PredictiveAnalytics';
import { BarChart3 } from 'lucide-react';

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
                            <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase ">Intelligence</h1>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Clinical performance engine • Activating</p>
                        </div>
                    </div>
                    <p className="text-slate-500 font-bold max-w-lg leading-relaxed">
                        Decrypting complex clinical workflows into actionable professional insights. Optimize your practice with real-time patient engagement data.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-6 py-2 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20 flex items-center gap-3 shadow-inner">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(79,70,229,1)]"></span>
                        Neural Analysis Sync Activating
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
                {/* Advanced Peak Hours Component */}
                <div className="glass-card p-1">
                    <PeakHoursAnalytics doctorId={user.id} />
                </div>
                
                {/* Predictive Intelligence Module */}
                <div className="glass-card p-1">
                    <PredictiveAnalytics doctorId={user.id} />
                </div>
            </div>
        </div>
    );
};

export default DoctorAnalytics;
