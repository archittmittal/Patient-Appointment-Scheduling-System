import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import PeakHoursAnalytics from '../components/PeakHoursAnalytics';
import { BarChart3, Clock, TrendingUp } from 'lucide-react';

const DoctorAnalytics = () => {
    const { user } = useAuth();

    if (!user || user.role !== 'DOCTOR') {
        return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 px-4 md:px-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100/50">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <BarChart3 size={20} strokeWidth={2.5} />
                        </span>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Clinical Intelligence</h1>
                    </div>
                    <p className="text-slate-400 font-bold text-sm">Actionable insights into your professional practice and patient engagement.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        Real-time Data Stream
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-12">
                {/* Integration of Peak Hours Analytics */}
                <PeakHoursAnalytics doctorId={user.id} />
                
                {/* Placeholder for future detailed analytics */}
                <div className="glass-card p-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
                    
                    <div className="flex flex-col items-center text-center space-y-6 max-w-lg mx-auto">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 group-hover:text-indigo-400 group-hover:bg-indigo-50 transition-all duration-500 shadow-inner">
                            <TrendingUp size={36} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Patient Retention Engine</h2>
                            <p className="text-sm font-bold text-slate-400 leading-relaxed">
                                Our clinical intelligence engineers are fine-tuning advanced metrics for longitudinal patient tracking and outcome analysis.
                            </p>
                        </div>
                        <div className="pt-4">
                            <span className="px-8 py-3 bg-slate-50 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] border border-slate-100 select-none">
                                Module Under Development
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorAnalytics;
