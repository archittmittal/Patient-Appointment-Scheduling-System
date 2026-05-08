import React, { useState, useEffect, useCallback } from 'react';
import { Users, Calendar, Stethoscope, CheckCircle, Clock, Activity, AlertCircle, TrendingUp, ArrowUpRight, Zap, RefreshCw, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import EmergencyModal from '../components/EmergencyModal';

const StatCard = ({ title, value, icon: Icon, color, onClick, trend }) => (
    <button
        onClick={onClick}
        className={`glass-card p-8 rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 flex flex-col items-start justify-between hover:shadow-2xl hover:-translate-y-1 transition-all text-left w-full group relative overflow-hidden ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
        <div className={`absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity`}>
            <Icon size={80} />
        </div>
        
        <div className="flex items-center justify-between w-full mb-6">
            <div className={`p-4 rounded-2xl ${color} shadow-inner border border-white/20 group-hover:rotate-12 transition-transform`}>
                <Icon size={24} strokeWidth={2.5} />
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-widest italic">
                    <TrendingUp size={12} /> {trend}
                </div>
            )}
        </div>

        <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic opacity-60">{title}</p>
            <h3 className="text-4xl font-black text-[var(--text-base)] tracking-tighter italic tabular-nums leading-none">{value}</h3>
        </div>
        
        {onClick && (
            <div className="mt-6 flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest italic opacity-0 group-hover:opacity-100 transition-opacity">
                Execute Matrix <ArrowUpRight size={14} />
            </div>
        )}
    </button>
);

const QueueBadge = ({ label, count, bg, text }) => (
    <div className={`flex flex-col items-center flex-1 px-3 py-4 rounded-2xl border ${bg} transition-all hover:scale-[1.02]`}>
        <span className={`text-xl font-black italic tracking-tighter ${text}`}>{count}</span>
        <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${text} opacity-60 mt-1 italic`}>{label}</span>
    </div>
);

const DoctorQueueCard = ({ data }) => {
    const total = data.waiting + data.in_progress + data.completed + data.missed;
    const completedPct = total > 0 ? Math.round((data.completed / total) * 100) : 0;

    return (
        <div className="glass-card rounded-[2.5rem] border-none shadow-xl shadow-slate-200/40 p-8 hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02]"><Activity size={60} /></div>
            
            <div className="flex items-start justify-between mb-8 relative z-10">
                <div>
                    <h4 className="text-lg font-black text-[var(--text-base)] uppercase italic tracking-tighter leading-none">{data.doctor_name}</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-2 italic opacity-70">{data.specialty}</p>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[20px] font-black text-[var(--text-base)] italic leading-none">{data.total_today}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Total Nodes</span>
                </div>
            </div>

            <div className="flex gap-3 mb-8 relative z-10">
                <QueueBadge label="Waiting"  count={data.waiting}     bg="bg-amber-500/10 border-amber-500/10"  text="text-amber-600" />
                <QueueBadge label="Active"   count={data.in_progress} bg="bg-primary/10 border-primary/10"    text="text-primary" />
                <QueueBadge label="Done"     count={data.completed}   bg="bg-emerald-500/10 border-emerald-500/10"   text="text-emerald-600" />
            </div>

            {total > 0 && (
                <div className="mb-8 relative z-10">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 italic">
                        <span>Cluster Progress</span>
                        <span className="text-primary">{completedPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100/50 rounded-full h-1.5 overflow-hidden border border-slate-100/30 p-0.5">
                        <div
                            className="bg-primary h-full rounded-full transition-all duration-1000 ease-out shadow-lg shadow-primary/20"
                            style={{ width: `${completedPct}%` }}
                        />
                    </div>
                </div>
            )}

            {data.queue.length > 0 && (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2 no-scrollbar relative z-10">
                    {data.queue.map(q => (
                        <div key={q.queue_id} className="flex items-center justify-between text-[11px] bg-white/40 border border-slate-100/50 rounded-xl px-4 py-3 hover:bg-white/60 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="font-black text-[9px] bg-primary/10 text-primary border border-primary/10 rounded-lg px-2 py-1 italic tracking-tighter">
                                    #{q.queue_number}
                                </span>
                                <span className="text-[var(--text-base)] font-black uppercase italic tracking-tighter">{q.patient_name}</span>
                            </div>
                            <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest italic border ${
                                q.queue_status === 'WAITING'     ? 'bg-amber-500/10 text-amber-500 border-amber-500/10' :
                                q.queue_status === 'IN_PROGRESS' ? 'bg-primary/10 text-primary border-primary/10 animate-pulse' :
                                q.queue_status === 'COMPLETED'   ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10' :
                                                                    'bg-rose-500/10 text-rose-500 border-rose-500/10'
                            }`}>
                                {q.queue_status === 'IN_PROGRESS' ? 'Active' : q.queue_status}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {data.queue.length === 0 && (
                <div className="py-6 text-center border border-dashed border-slate-200 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">No active nodes detected</p>
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [queueData, setQueueData] = useState([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [queueLoading, setQueueLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);

    useEffect(() => {
        apiClient.get('/api/admin/stats')
            .then(data => setStats(data))
            .finally(() => setStatsLoading(false));
    }, []);

    const fetchQueue = useCallback(async () => {
        const data = await apiClient.get('/api/admin/queue-overview');
        setQueueData(Array.isArray(data) ? data : []);
        setLastUpdated(new Date());
        setQueueLoading(false);
    }, []);

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 20000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    if (statsLoading && queueLoading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-20 space-y-4">
             <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
             <p className="text-sm font-medium text-slate-500 tracking-wide uppercase italic">Synchronizing Admin Matrix...</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000 px-1">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 px-1">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 transition-transform duration-700">
                        <Activity size={36} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none">Admin Matrix</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 italic leading-none opacity-60">High-fidelity clinical infrastructure control</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => setIsEmergencyOpen(true)}
                        className="flex-1 md:flex-none px-8 py-5 bg-rose-500 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] italic shadow-2xl shadow-rose-500/20 hover:shadow-rose-500/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                    >
                        <AlertCircle size={18} strokeWidth={3} /> Emergency Override
                    </button>
                    <button 
                        onClick={() => fetchQueue()}
                        className="p-5 bg-white/40 border border-slate-100/50 rounded-[2rem] text-slate-400 hover:text-primary transition-all active:rotate-180 duration-700"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {/* Overall stats */}
            <section className="space-y-6">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] italic flex items-center gap-3 px-1">
                    <div className="w-8 h-[1px] bg-slate-200"></div> System Core Stats
                </h2>
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <StatCard
                            title="Total Doctors"
                            value={stats.total_doctors}
                            icon={Stethoscope}
                            color="bg-primary/10 text-primary"
                            onClick={() => navigate('/admin-users')}
                            trend="+2.4%"
                        />
                        <StatCard
                            title="Total Patients"
                            value={stats.total_patients}
                            icon={Users}
                            color="bg-emerald-500/10 text-emerald-500"
                            onClick={() => navigate('/admin-users')}
                            trend="+12.1%"
                        />
                        <StatCard
                            title="Global Connections"
                            value={stats.total_appointments}
                            icon={Calendar}
                            color="bg-violet-500/10 text-violet-500"
                            onClick={() => navigate('/admin-appointments')}
                            trend="+5.7%"
                        />
                    </div>
                )}
            </section>

            {/* Today's breakdown */}
            <section className="space-y-6">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] italic flex items-center gap-3 px-1">
                    <div className="w-8 h-[1px] bg-slate-200"></div> Temporal Load Matrix
                </h2>
                {stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Active Today"
                            value={stats.today_total ?? 0}
                            icon={Activity}
                            color="bg-orange-500/10 text-orange-500"
                            onClick={() => navigate('/admin-appointments')}
                        />
                        <StatCard
                            title="Confirmed Nodes"
                            value={stats.today_confirmed ?? 0}
                            icon={CheckCircle}
                            color="bg-primary/10 text-primary"
                        />
                        <StatCard
                            title="Processed Nodes"
                            value={stats.today_completed ?? 0}
                            icon={Zap}
                            color="bg-emerald-500/10 text-emerald-500"
                        />
                        <StatCard
                            title="Pending Cycles"
                            value={stats.today_pending ?? 0}
                            icon={Clock}
                            color="bg-amber-500/10 text-amber-500"
                        />
                    </div>
                )}
            </section>

            {/* Top doctors today */}
            {stats?.top_doctors_today?.length > 0 && (
                <section className="space-y-6">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] italic flex items-center gap-3 px-1">
                        <div className="w-8 h-[1px] bg-slate-200"></div> High-Volume Specialists
                    </h2>
                    <div className="glass-card rounded-[3rem] border-none shadow-2xl shadow-slate-200/50 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/50 border-b border-slate-100/50">
                                    <tr>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Doctor Node</th>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Specialization</th>
                                        <th className="px-8 py-6 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Cycle Volume</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50/50">
                                    {stats.top_doctors_today.map(d => (
                                        <tr key={d.id} className="hover:bg-primary-light/5 transition-colors group">
                                            <td className="px-8 py-5 font-black text-[var(--text-base)] uppercase italic tracking-tighter">Dr. {d.first_name} {d.last_name}</td>
                                            <td className="px-8 py-5 text-[10px] font-black text-primary uppercase tracking-widest italic opacity-70">{d.specialty}</td>
                                            <td className="px-8 py-5 text-right font-black text-2xl text-[var(--text-base)] italic tabular-nums tracking-tighter">{d.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            {/* Live queue overview (A3) */}
            <section className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] italic flex items-center gap-3">
                        <div className="w-8 h-[1px] bg-slate-200"></div> Real-Time Queue Matrix
                    </h2>
                    <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest italic bg-white/40 px-4 py-2 rounded-full border border-slate-100/50 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/40" />
                        {lastUpdated
                            ? `SYNCED ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                            : 'REFRESHING...'}
                    </div>
                </div>

                {queueData.length === 0 && !queueLoading ? (
                    <div className="glass-card p-24 text-center rounded-[4rem] border-none shadow-2xl opacity-60">
                        <Clock size={64} className="text-slate-200 mx-auto mb-8 opacity-20" />
                        <h3 className="text-xl font-black text-slate-400 uppercase italic tracking-tighter">No Active Cycles</h3>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic mt-4">System idling. Waiting for patient node engagement.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {queueData.map(d => (
                            <DoctorQueueCard key={d.doctor_id} data={d} />
                        ))}
                    </div>
                )}
            </section>

            {/* Quick actions */}
            <section className="space-y-6">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] italic flex items-center gap-3 px-1">
                    <div className="w-8 h-[1px] bg-slate-200"></div> Direct Command Interface
                </h2>
                <div className="grid md:grid-cols-2 gap-8">
                    <div
                        onClick={() => navigate('/admin-users')}
                        className="glass-card p-10 rounded-[3rem] border-none shadow-xl shadow-slate-200/40 cursor-pointer hover:shadow-2xl hover:bg-primary-light/10 transition-all group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-8">
                            <div className="p-5 bg-primary/10 text-primary rounded-2xl border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform"><Users size={32} strokeWidth={2.5} /></div>
                            <div>
                                <h3 className="text-2xl font-black text-[var(--text-base)] uppercase italic tracking-tighter leading-none">Manage Registry</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 italic opacity-60">Provision & audit system nodes</p>
                            </div>
                        </div>
                        <ArrowUpRight size={24} className="text-slate-200 group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                    </div>

                    <div
                        onClick={() => navigate('/admin-appointments')}
                        className="glass-card p-10 rounded-[3rem] border-none shadow-xl shadow-slate-200/40 cursor-pointer hover:shadow-2xl hover:bg-emerald-500/5 transition-all group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-8">
                            <div className="p-5 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20 shadow-inner group-hover:rotate-12 transition-transform"><Calendar size={32} strokeWidth={2.5} /></div>
                            <div>
                                <h3 className="text-2xl font-black text-[var(--text-base)] uppercase italic tracking-tighter leading-none">Global Log</h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 italic opacity-60">Full-spectrum synchronization audit</p>
                            </div>
                        </div>
                        <ArrowUpRight size={24} className="text-slate-200 group-hover:text-emerald-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                    </div>
                </div>
            </section>

            {/* Emergency Modal */}
            <EmergencyModal 
                isOpen={isEmergencyOpen} 
                onClose={() => setIsEmergencyOpen(false)}
                onSuccess={() => {
                    fetchQueue();
                }}
            />
        </div>
    );
};

export default AdminDashboard;

export default AdminDashboard;
