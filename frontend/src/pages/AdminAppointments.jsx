import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Clock, Filter, Search, X, CheckCircle2, MoreVertical, Trash2 } from 'lucide-react';
import apiClient from '../services/apiClient';

const STATUS_STYLES = {
    CONFIRMED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    COMPLETED: 'bg-primary/10 text-primary border-primary/20',
    CANCELLED: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const AdminAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const data = await apiClient.get('/api/admin/appointments');
            setAppointments(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const cancelAppointment = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this appointment? This action is irreversible.')) return;
        try {
            const result = await apiClient.patch(`/api/appointments/${id}/cancel`);
            if (result.error) {
                alert(result.message || 'Could not cancel');
                return;
            }
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a));
        } catch (err) {
            console.error('Cancel error:', err);
            alert('Failed to cancel appointment');
        }
    };

    const filtered = appointments.filter(a => {
        const matchSearch = search === '' ||
            `${a.patient_first} ${a.patient_last}`.toLowerCase().includes(search.toLowerCase()) ||
            `${a.doctor_first} ${a.doctor_last}`.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'ALL' || a.status === filterStatus;
        return matchSearch && matchStatus;
    });

    if (isLoading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-20 space-y-4">
             <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
             <p className="text-sm font-medium text-slate-500 tracking-wide uppercase italic">Loading administrative matrix...</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div>
                    <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tight uppercase italic leading-none">Global Registry</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 italic leading-none opacity-60">Complete audit log of all clinical synchronizations</p>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED'].map(s => (
                        <button 
                            key={s} 
                            onClick={() => setFilterStatus(s)}
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest italic transition-all whitespace-nowrap border ${
                                filterStatus === s 
                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                                    : 'bg-white/40 border-slate-100/50 text-slate-500 hover:bg-white/60'
                            }`}
                        >
                            {s === 'ALL' ? `All (${appointments.length})` : s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters & Search */}
            <div className="glass-card p-6 border-none shadow-xl shadow-slate-200/40 relative group overflow-hidden">
                <div className="relative">
                    <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="SEARCH BY PATIENT OR DOCTOR NODE..."
                        className="w-full pl-16 pr-6 py-5 bg-white/40 border border-slate-100/50 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all italic shadow-inner"
                    />
                </div>
            </div>

            <div className="glass-card overflow-hidden border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-100/50">
                            <tr>
                                <th className="text-left px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Patient Node</th>
                                <th className="text-left px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Doctor Node</th>
                                <th className="text-left px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Temporal Data</th>
                                <th className="text-left px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Clinical Notes</th>
                                <th className="text-left px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50/50">
                            {filtered.map(a => (
                                <tr key={a.id} className="hover:bg-primary-light/5 transition-all duration-300 group/row">
                                    <td className="px-8 py-6">
                                        <p className="font-black text-[var(--text-base)] text-sm uppercase italic tracking-tight">{a.patient_first} {a.patient_last}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="font-black text-[var(--text-base)] text-sm uppercase italic tracking-tight">Dr. {a.doctor_first} {a.doctor_last}</p>
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1 opacity-70 italic">{a.specialty}</p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="flex items-center gap-2 text-[11px] font-black text-slate-600 uppercase tracking-tighter italic">
                                                <Calendar size={14} className="text-primary" />
                                                {new Date(a.appointment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest italic leading-none">
                                                <Clock size={14} />
                                                {a.time_slot}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 max-w-xs">
                                        {a.symptoms ? (
                                            <div className="flex items-start gap-2.5 text-[10px] font-bold text-slate-500 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 italic leading-relaxed">
                                                <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
                                                <span className="line-clamp-2">{a.symptoms}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">NO SYMPTOMS LOGGED</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-4 py-1.5 text-[9px] font-black rounded-full uppercase tracking-widest italic border shadow-sm ${STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'}`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        {(a.status === 'CONFIRMED' || a.status === 'PENDING') && (
                                            <button
                                                onClick={() => cancelAppointment(a.id)}
                                                className="p-3 text-rose-500 bg-rose-500/5 border border-rose-500/10 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm hover:shadow-rose-500/20 active:scale-90"
                                                title="Cancel Appointment"
                                            >
                                                <Trash2 size={18} strokeWidth={2.5} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="py-24 text-center">
                             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Search size={32} className="text-slate-200" />
                             </div>
                             <h3 className="text-lg font-black text-slate-400 uppercase italic tracking-tighter">No connections found</h3>
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-2 italic">Refine your search parameters in the matrix</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminAppointments;

export default AdminAppointments;
