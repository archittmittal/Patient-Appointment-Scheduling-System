import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, AlertCircle, CheckCircle2, Activity, Users, RefreshCw, X, FileText, Pill, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const QUEUE_POLL_INTERVAL = 20_000; // 20 seconds

const STATUS_COLORS = {
    WAITING:     'bg-amber-50 text-amber-700 border-amber-100',
    IN_PROGRESS: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    COMPLETED:   'bg-emerald-50 text-emerald-700 border-emerald-100',
    MISSED:      'bg-rose-50 text-rose-700 border-rose-100',
};

const EMPTY_NOTES = { diagnosis: '', notes: '', prescription: '', follow_up_date: '' };

const NotesModal = ({ item, onSave, onClose, saving }) => {
    const [form, setForm] = useState(EMPTY_NOTES);
    const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="glass-modal rounded-[2.5rem] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-10 border-b border-slate-100 bg-white/50">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Clinical Assessment</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Patient: <span className="text-indigo-600 font-bold">{item.first_name} {item.last_name}</span></p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 rounded-2xl hover:bg-slate-100 transition-all active:scale-95">
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="p-10 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Current Diagnosis
                        </label>
                        <div className="relative group">
                            <FileText size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                name="diagnosis"
                                value={form.diagnosis}
                                onChange={change}
                                placeholder="Enter clinical diagnosis..."
                                className="w-full glass-card border-slate-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 bg-white/50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Prescription & Dosage
                        </label>
                        <div className="relative group">
                            <Pill size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                            <textarea
                                name="prescription"
                                value={form.prescription}
                                onChange={change}
                                rows={3}
                                placeholder="List medications and instructions..."
                                className="w-full glass-card border-slate-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 bg-white/50 resize-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Doctor's Private Notes
                        </label>
                        <div className="relative group">
                            <AlertCircle size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                            <textarea
                                name="notes"
                                value={form.notes}
                                onChange={change}
                                rows={3}
                                placeholder="Confidential clinical observations..."
                                className="w-full glass-card border-slate-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 bg-white/50 resize-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Follow-up Window
                        </label>
                        <div className="relative group">
                            <CalendarCheck size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="date"
                                name="follow_up_date"
                                value={form.follow_up_date}
                                onChange={change}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full glass-card border-slate-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 bg-white/50"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 p-10 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        className="btn-secondary flex-1 py-4 font-black text-xs uppercase tracking-widest"
                    >
                        Discard
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={saving}
                        className="btn-primary flex-1 py-4 font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 disabled:opacity-60"
                    >
                        {saving ? 'Processing...' : 'Verify & Complete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DoctorDashboard = () => {
    const { user } = useAuth();
    const [patients, setPatients] = useState([]);
    const [queue, setQueue] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('queue');
    const [updatingId, setUpdatingId] = useState(null);
    const [queueLastUpdated, setQueueLastUpdated] = useState(null);
    const [notesModal, setNotesModal] = useState(null); // { queueId, item }
    
    // Issue #40: Delay propagation state
    const [delayInfo, setDelayInfo] = useState({ isDelayed: false, delayMins: 0, reason: '' });
    const [showDelayModal, setShowDelayModal] = useState(false);
    const [delayForm, setDelayForm] = useState({ minutes: 15, reason: '' });
    const [settingDelay, setSettingDelay] = useState(false);

    const fetchData = async () => {
        if (!user?.id) return;
        try {
            const [patientsRes, queueRes, delayRes] = await Promise.all([
                fetch(`${API}/api/doctors/${user.id}/patients`),
                fetch(`${API}/api/doctors/${user.id}/queue`),
                fetch(`${API}/api/doctors/${user.id}/delay-status`)
            ]);
            const patientsData = await patientsRes.json();
            const queueData = await queueRes.json();
            setPatients(patientsData);
            setQueue(queueData);
            setQueueLastUpdated(new Date());
            
            // Issue #40: Update delay status
            if (delayRes.ok) {
                const delayData = await delayRes.json();
                setDelayInfo({
                    isDelayed: delayData.isDelayed || false,
                    delayMins: delayData.delayMins || 0,
                    reason: delayData.reason || ''
                });
            }
        } catch (err) {
            console.error('Doctor dashboard error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Issue #40: Set delay for all waiting patients
    const handleSetDelay = async () => {
        if (!user?.id) return;
        setSettingDelay(true);
        try {
            const res = await fetch(`${API}/api/doctors/${user.id}/delay`, {
                method: 'POST',
                headers: authedHeaders(true),
                body: JSON.stringify({
                    delayMins: delayForm.minutes,
                    reason: delayForm.reason || 'Running behind schedule'
                })
            });
            if (res.ok) {
                setDelayInfo({
                    isDelayed: true,
                    delayMins: delayForm.minutes,
                    reason: delayForm.reason || 'Running behind schedule'
                });
                setShowDelayModal(false);
                setDelayForm({ minutes: 15, reason: '' });
            }
        } catch (err) {
            console.error('Set delay error:', err);
        } finally {
            setSettingDelay(false);
        }
    };

    // Issue #40: Clear delay
    const handleClearDelay = async () => {
        if (!user?.id) return;
        setSettingDelay(true);
        try {
            const res = await fetch(`${API}/api/doctors/${user.id}/delay`, {
                method: 'POST',
                headers: authedHeaders(true),
                body: JSON.stringify({ delayMins: 0, reason: '' })
            });
            if (res.ok) {
                setDelayInfo({ isDelayed: false, delayMins: 0, reason: '' });
            }
        } catch (err) {
            console.error('Clear delay error:', err);
        } finally {
            setSettingDelay(false);
        }
    };

    // Initial full load
    useEffect(() => { fetchData(); }, [user?.id]);

    // Auto-refresh only the queue every 20 s (patients list is static)
    useEffect(() => {
        if (!user?.id) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/doctors/${user.id}/queue`);
                const data = await res.json();
                setQueue(data);
                setQueueLastUpdated(new Date());
            } catch (err) {
                console.error('Queue auto-refresh error:', err);
            }
        }, QUEUE_POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [user?.id]);

    const updateQueueStatus = async (queueId, newStatus, extra = {}) => {
        setUpdatingId(queueId);
        try {
            const res = await fetch(`${API}/api/appointments/queue/${queueId}/status`, {
                method: 'PATCH',
                headers: authedHeaders(true),
                body: JSON.stringify({ status: newStatus, ...extra })
            });
            if (!res.ok) throw new Error('Failed to update status on server');
            
            setQueue(prev => prev.map(q => q.queue_id === queueId ? { ...q, queue_status: newStatus } : q));
        } catch (err) {
            console.error('Queue update error:', err);
            alert('Failed to update patient status. Please try again.');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleCompleteClick = (item) => {
        setNotesModal({ queueId: item.queue_id, item });
    };

    const handleNotesSave = async (form) => {
        if (!notesModal) return;
        await updateQueueStatus(notesModal.queueId, 'COMPLETED', form);
        setNotesModal(null);
        // Refresh patients list so notes appear in All Patients tab
        fetchData();
    };

    const markMissed = async (queueId) => {
        setUpdatingId(queueId);
        try {
            await fetch(`${API}/api/appointments/queue/${queueId}/status`, {
                method: 'PATCH',
                headers: authedHeaders(true),
                body: JSON.stringify({ status: 'MISSED' })
            });
            setQueue(prev => prev.map(q => q.queue_id === queueId ? { ...q, queue_status: 'MISSED' } : q));
        } catch (err) {
            console.error('Queue update error:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    if (isLoading) {
        return <div className="p-10 text-center text-gray-500 animate-pulse">Loading doctor dashboard...</div>;
    }

    return (
        <div className="space-y-8 pb-10">
            {notesModal && (
                <NotesModal
                    item={notesModal.item}
                    saving={updatingId === notesModal.queueId}
                    onSave={handleNotesSave}
                    onClose={() => setNotesModal(null)}
                />
            )}

            {/* Issue #40: Delay Modal */}
            {showDelayModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="glass-modal rounded-[2.5rem] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 border-b border-slate-100 bg-white/50">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Delay</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">Notify patients about schedule changes.</p>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Estimated Lag Time</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[15, 30, 45, 60, 90, 120].map(mins => (
                                        <button
                                            key={mins}
                                            onClick={() => setDelayForm(f => ({ ...f, minutes: mins }))}
                                            className={`py-3 rounded-[1.25rem] text-xs font-black transition-all duration-300 ${
                                                delayForm.minutes === mins 
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                                    : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                                            }`}
                                        >
                                            {mins} MIN
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Reason for Delay</label>
                                <input
                                    type="text"
                                    value={delayForm.reason}
                                    onChange={e => setDelayForm(f => ({ ...f, reason: e.target.value }))}
                                    placeholder="e.g. Critical surgery, Case overflow..."
                                    className="w-full glass-card border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 bg-white/50 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 p-10 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setShowDelayModal(false)}
                                className="btn-secondary flex-1 py-4 font-black text-xs uppercase tracking-widest"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSetDelay}
                                disabled={settingDelay}
                                className="btn-primary-indigo flex-1 py-4 font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 disabled:opacity-60"
                            >
                                {settingDelay ? 'Propagating...' : 'Set & Notify'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        Hello, <span className="text-indigo-600">Dr. {user?.last_name}</span>
                    </h1>
                    <p className="text-slate-500 font-bold mt-2 flex items-center gap-2">
                        <Activity size={16} className="text-indigo-400" />
                        Clinical Workflow Strategy • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Calendar size={20} strokeWidth={2.5} />
                    </div>
                    <div className="pr-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule</p>
                        <p className="text-sm font-bold text-slate-700">8:00 AM - 5:00 PM</p>
                    </div>
                </div>
            </div>

            {/* Issue #40: Delay Alert Banner */}
            {delayInfo.isDelayed && (
                <div className="glass-card border-amber-100 bg-amber-50/30 p-6 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-amber-100 rounded-[1.25rem] flex items-center justify-center shadow-inner">
                            <AlertTriangle className="text-amber-600" size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-lg font-black text-amber-900 tracking-tight">Queue Lag Detected: {delayInfo.delayMins}m</p>
                            <p className="text-sm text-amber-700/80 font-bold mt-0.5">{delayInfo.reason || 'Workflow congestion in progress.'}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClearDelay}
                        disabled={settingDelay}
                        className="btn-secondary py-3 px-6 font-black text-xs uppercase tracking-widest bg-white/80 hover:bg-white text-amber-700 border-amber-200"
                    >
                        {settingDelay ? 'Syncing...' : 'Resolve Delay'}
                    </button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card group hover:scale-[1.02] transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                            <Users size={24} strokeWidth={2.5} />
                        </div>
                        <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-widest">Active</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Patients</p>
                    <h3 className="text-4xl font-black text-slate-900 mt-1 tracking-tighter">{patients.length}</h3>
                </div>

                <div className="glass-card group hover:scale-[1.02] transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm">
                            <Calendar size={24} strokeWidth={2.5} />
                        </div>
                        <span className="text-[10px] font-black text-emerald-50 text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-widest">Today</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Queue Size</p>
                    <h3 className="text-4xl font-black text-slate-900 mt-1 tracking-tighter">{queue.length}</h3>
                </div>

                <div className="glass-card group hover:scale-[1.02] transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-all duration-500 shadow-sm">
                            <Activity size={24} strokeWidth={2.5} />
                        </div>
                        <span className="text-[10px] font-black text-sky-500 bg-sky-50 px-2 py-1 rounded-lg uppercase tracking-widest">Live</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">In Progress</p>
                    <h3 className="text-4xl font-black text-slate-900 mt-1 tracking-tighter">{queue.filter(q => q.queue_status === 'IN_PROGRESS').length}</h3>
                </div>

                <button 
                    onClick={() => !delayInfo.isDelayed && setShowDelayModal(true)}
                    className={`glass-card group hover:scale-[1.02] transition-all duration-300 text-left relative overflow-hidden ${
                        delayInfo.isDelayed ? 'border-amber-200' : ''
                    }`}
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm ${
                            delayInfo.isDelayed ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-amber-500 group-hover:text-white'
                        }`}>
                            <Clock size={24} strokeWidth={2.5} />
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${
                            delayInfo.isDelayed ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors'
                        }`}>
                            {delayInfo.isDelayed ? 'Delayed' : 'Action'}
                        </span>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Service Delay</p>
                    <h3 className={`text-4xl font-black mt-1 tracking-tighter ${delayInfo.isDelayed ? 'text-amber-600' : 'text-slate-300'}`}>
                        {delayInfo.isDelayed ? `${delayInfo.delayMins}M` : '0M'}
                    </h3>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 pt-4">
                <div className="flex gap-10">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`pb-4 px-1 text-sm font-black uppercase tracking-widest transition-all relative ${
                            activeTab === 'queue' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Live Queue ({queue.length})
                        {activeTab === 'queue' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('patients')}
                        className={`pb-4 px-1 text-sm font-black uppercase tracking-widest transition-all relative ${
                            activeTab === 'patients' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Patient Registry ({patients.length})
                        {activeTab === 'patients' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                    </button>
                </div>
                {activeTab === 'queue' && queueLastUpdated && (
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4">
                        <RefreshCw size={12} className="text-indigo-400" />
                        Synced {queueLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>

            {/* Today's Queue */}
            {activeTab === 'queue' && (
                <div className="space-y-4">
                    {queue.length === 0 ? (
                        <div className="glass-card p-20 text-center">
                            <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-500 font-bold">No clinical sessions scheduled for today.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {queue.map(item => (
                                <div key={item.queue_id} className="glass-card p-6 flex items-center justify-between group hover:border-indigo-200 transition-all duration-300">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 text-white flex flex-col items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500">
                                            <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">Slot</span>
                                            <span className="text-2xl font-black">{item.queue_number}</span>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-slate-900 tracking-tight">{item.first_name} {item.last_name}</h4>
                                            <div className="flex items-center gap-4 mt-1">
                                                <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-indigo-400" /> {item.time_slot}
                                                </p>
                                                <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${STATUS_COLORS[item.queue_status]}`}>
                                                    {item.queue_status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            {item.symptoms && (
                                                <div className="mt-3 flex items-start gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100 max-w-sm">
                                                    <Activity size={12} className="text-slate-400 mt-0.5" />
                                                    <p className="text-[11px] font-bold text-slate-600 line-clamp-1 italic">
                                                        "{item.symptoms}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {item.queue_status === 'WAITING' && (
                                            <button
                                                disabled={updatingId === item.queue_id}
                                                onClick={() => updateQueueStatus(item.queue_id, 'IN_PROGRESS')}
                                                className="btn-primary py-2.5 px-6 font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95"
                                            >
                                                {updatingId === item.queue_id ? '...' : 'Initiate Session'}
                                            </button>
                                        )}
                                        {item.queue_status === 'IN_PROGRESS' && (
                                            <button
                                                disabled={updatingId === item.queue_id}
                                                onClick={() => handleCompleteClick(item)}
                                                className="btn-primary-indigo py-2.5 px-6 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 active:scale-95"
                                            >
                                                {updatingId === item.queue_id ? '...' : 'Complete Analysis'}
                                            </button>
                                        )}
                                        {item.queue_status === 'WAITING' && (
                                            <button
                                                disabled={updatingId === item.queue_id}
                                                onClick={() => markMissed(item.queue_id)}
                                                className="btn-secondary py-2.5 px-6 font-black text-xs uppercase tracking-widest border-rose-100 text-rose-600 hover:bg-rose-50 active:scale-95"
                                            >
                                                Missed
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* All Patients */}
            {activeTab === 'patients' && (
                <div className="space-y-4">
                    {patients.length === 0 ? (
                        <div className="glass-card p-20 text-center">
                            <Users size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-500 font-bold">No patient history found in registry.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {patients.map((patient, idx) => (
                                <div key={`${patient.appointment_id}-${idx}`} className="glass-card p-6 group hover:border-indigo-200 transition-all duration-300">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-105 transition-all duration-500">
                                                <User size={28} strokeWidth={2} />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-slate-900 tracking-tight">{patient.first_name} {patient.last_name}</h4>
                                                <p className="text-sm font-bold text-slate-400">{patient.email}</p>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest"><Calendar size={12} className="text-indigo-400" />{new Date(patient.appointment_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest"><Clock size={12} className="text-indigo-400" />{patient.time_slot}</span>
                                                    {patient.blood_group && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md uppercase tracking-widest">Type {patient.blood_group}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`px-4 py-1.5 text-[10px] font-black rounded-full uppercase tracking-widest border ${patient.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : patient.status === 'COMPLETED' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {patient.status}
                                        </span>
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {patient.symptoms && (
                                            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
                                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                                    <AlertCircle size={12} strokeWidth={2.5} /> Reported Symptoms
                                                </p>
                                                <p className="text-sm font-bold text-amber-900/80 leading-relaxed italic">"{patient.symptoms}"</p>
                                            </div>
                                        )}

                                        {(patient.diagnosis || patient.notes || patient.prescription || patient.follow_up_date) && (
                                            <div className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4 space-y-3">
                                                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <FileText size={12} strokeWidth={2.5} /> Consultation Record
                                                </p>
                                                {patient.diagnosis && (
                                                    <p className="text-sm font-bold text-slate-700">
                                                        <span className="text-indigo-600">Diagnosis:</span> {patient.diagnosis}
                                                    </p>
                                                )}
                                                {patient.prescription && (
                                                    <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">
                                                        <span className="text-indigo-600">Rx:</span> {patient.prescription}
                                                    </p>
                                                )}
                                                {patient.follow_up_date && (
                                                    <div className="pt-2 border-t border-indigo-100/50 flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                                        <CalendarCheck size={12} /> Suggested Follow-up: {new Date(patient.follow_up_date).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DoctorDashboard;
