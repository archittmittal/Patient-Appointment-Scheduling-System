import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, AlertCircle, CheckCircle2, Activity, Users, RefreshCw, X, FileText, Pill, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const QUEUE_POLL_INTERVAL = 20_000; // 20 seconds

const STATUS_COLORS = {
    WAITING:     'bg-yellow-100 text-yellow-700 border-yellow-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED:   'bg-green-100 text-green-700 border-green-200',
    MISSED:      'bg-red-100 text-red-700 border-red-200',
};

const EMPTY_NOTES = { diagnosis: '', notes: '', prescription: '', follow_up_date: '' };

const NotesModal = ({ item, onSave, onClose, saving }) => {
    const [form, setForm] = useState(EMPTY_NOTES);
    const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Complete Consultation</h3>
                        <p className="text-sm text-gray-500">{item.first_name} {item.last_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <span className="flex items-center gap-1.5"><FileText size={14} /> Diagnosis</span>
                        </label>
                        <input
                            name="diagnosis"
                            value={form.diagnosis}
                            onChange={change}
                            placeholder="e.g. Hypertension stage 1"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <span className="flex items-center gap-1.5"><Pill size={14} /> Prescription</span>
                        </label>
                        <textarea
                            name="prescription"
                            value={form.prescription}
                            onChange={change}
                            rows={3}
                            placeholder="Medications, dosage, instructions..."
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <span className="flex items-center gap-1.5"><AlertCircle size={14} /> Doctor's Notes</span>
                        </label>
                        <textarea
                            name="notes"
                            value={form.notes}
                            onChange={change}
                            rows={3}
                            placeholder="Observations, recommendations..."
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <span className="flex items-center gap-1.5"><CalendarCheck size={14} /> Follow-up Date (optional)</span>
                        </label>
                        <input
                            type="date"
                            name="follow_up_date"
                            value={form.follow_up_date}
                            onChange={change}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                </div>

                <div className="flex gap-3 px-5 pb-5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : 'Complete & Save'}
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
            await fetch(`${API}/api/appointments/queue/${queueId}/status`, {
                method: 'PATCH',
                headers: authedHeaders(true),
                body: JSON.stringify({ status: newStatus, ...extra })
            });
            setQueue(prev => prev.map(q => q.queue_id === queueId ? { ...q, queue_status: newStatus } : q));
        } catch (err) {
            console.error('Queue update error:', err);
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
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Set Running Delay</h3>
                                <p className="text-sm text-gray-500">Notify all waiting patients</p>
                            </div>
                            <button onClick={() => setShowDelayModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Delay Duration</label>
                                <div className="flex gap-2">
                                    {[10, 15, 20, 30, 45, 60].map(mins => (
                                        <button
                                            key={mins}
                                            onClick={() => setDelayForm(f => ({ ...f, minutes: mins }))}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                delayForm.minutes === mins 
                                                    ? 'bg-amber-500 text-white' 
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {mins}m
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                                <input
                                    type="text"
                                    value={delayForm.reason}
                                    onChange={e => setDelayForm(f => ({ ...f, reason: e.target.value }))}
                                    placeholder="e.g., Emergency case, Previous appointment extended"
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 px-5 pb-5">
                            <button
                                onClick={() => setShowDelayModal(false)}
                                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSetDelay}
                                disabled={settingDelay}
                                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
                            >
                                {settingDelay ? 'Setting...' : 'Set Delay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dr. {user?.first_name} {user?.last_name}'s Dashboard</h1>
                <p className="text-gray-500 mt-1">Manage your patients and today's queue.</p>
            </div>

            {/* Issue #40: Delay Alert Banner */}
            {delayInfo.isDelayed && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl">
                            <AlertTriangle className="text-amber-600" size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-amber-800">Running {delayInfo.delayMins} minutes behind</p>
                            {delayInfo.reason && <p className="text-sm text-amber-600">{delayInfo.reason}</p>}
                        </div>
                    </div>
                    <button
                        onClick={handleClearDelay}
                        disabled={settingDelay}
                        className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 rounded-xl hover:bg-amber-200 transition-colors disabled:opacity-60"
                    >
                        {settingDelay ? 'Clearing...' : 'Clear Delay'}
                    </button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Users size={20} /></div>
                        <p className="text-sm font-medium text-gray-500">Total Patients</p>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{patients.length}</h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-50 text-green-600 rounded-xl"><Calendar size={20} /></div>
                        <p className="text-sm font-medium text-gray-500">Today's Queue</p>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{queue.length}</h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><Activity size={20} /></div>
                        <p className="text-sm font-medium text-gray-500">In Progress</p>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{queue.filter(q => q.queue_status === 'IN_PROGRESS').length}</h3>
                </div>
                {/* Issue #40: Delay Management Card */}
                <div 
                    onClick={() => !delayInfo.isDelayed && setShowDelayModal(true)}
                    className={`rounded-2xl p-6 border shadow-sm cursor-pointer transition-all ${
                        delayInfo.isDelayed 
                            ? 'bg-amber-50 border-amber-200' 
                            : 'bg-white border-gray-100 hover:border-amber-300 hover:shadow-md'
                    }`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-xl ${delayInfo.isDelayed ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-600'}`}>
                            <Clock size={20} />
                        </div>
                        <p className="text-sm font-medium text-gray-500">
                            {delayInfo.isDelayed ? 'Current Delay' : 'Set Delay'}
                        </p>
                    </div>
                    <h3 className={`text-3xl font-bold ${delayInfo.isDelayed ? 'text-amber-600' : 'text-gray-400'}`}>
                        {delayInfo.isDelayed ? `${delayInfo.delayMins}m` : '—'}
                    </h3>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-gray-200">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'queue' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Today's Queue ({queue.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('patients')}
                        className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'patients' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        All Patients ({patients.length})
                    </button>
                </div>
                {activeTab === 'queue' && queueLastUpdated && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 pb-3">
                        <RefreshCw size={12} />
                        Updated {queueLastUpdated.toLocaleTimeString()}
                    </div>
                )}
            </div>

            {/* Today's Queue */}
            {activeTab === 'queue' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {queue.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">No patients in queue for today.</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {queue.map(item => (
                                <div key={item.queue_id} className="flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            {item.queue_number}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{item.first_name} {item.last_name}</h4>
                                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                                <Clock size={12} /> {item.time_slot}
                                            </p>
                                            {item.symptoms && (
                                                <p className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                                                    <span className="font-medium">Symptoms:</span> {item.symptoms}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border capitalize ${STATUS_COLORS[item.queue_status]}`}>
                                            {item.queue_status?.toLowerCase().replace('_', ' ')}
                                        </span>
                                        {item.queue_status === 'WAITING' && (
                                            <button
                                                disabled={updatingId === item.queue_id}
                                                onClick={() => updateQueueStatus(item.queue_id, 'IN_PROGRESS')}
                                                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                                            >
                                                {updatingId === item.queue_id ? '...' : 'Start'}
                                            </button>
                                        )}
                                        {item.queue_status === 'IN_PROGRESS' && (
                                            <button
                                                disabled={updatingId === item.queue_id}
                                                onClick={() => handleCompleteClick(item)}
                                                className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                            >
                                                {updatingId === item.queue_id ? '...' : 'Complete'}
                                            </button>
                                        )}
                                        {item.queue_status === 'WAITING' && (
                                            <button
                                                disabled={updatingId === item.queue_id}
                                                onClick={() => markMissed(item.queue_id)}
                                                className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
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
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {patients.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">No patients found.</div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {patients.map((patient, idx) => (
                                <div key={`${patient.appointment_id}-${idx}`} className="p-5 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                <User size={20} className="text-gray-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{patient.first_name} {patient.last_name}</h4>
                                                <p className="text-sm text-gray-500">{patient.email}</p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1"><Calendar size={12} />{new Date(patient.appointment_date).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1"><Clock size={12} />{patient.time_slot}</span>
                                                    {patient.blood_group && <span className="text-red-500 font-medium">{patient.blood_group}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full capitalize ${patient.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : patient.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {patient.status?.toLowerCase()}
                                        </span>
                                    </div>

                                    {patient.symptoms && (
                                        <div className="mt-3 ml-16 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                            <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                                                <AlertCircle size={12} /> Symptoms
                                            </p>
                                            <p className="text-sm text-amber-800">{patient.symptoms}</p>
                                        </div>
                                    )}

                                    {(patient.diagnosis || patient.notes || patient.prescription || patient.follow_up_date) && (
                                        <div className="mt-3 ml-16 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                                            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                                                <FileText size={12} /> Consultation Summary
                                            </p>
                                            {patient.diagnosis && (
                                                <p className="text-sm text-blue-800">
                                                    <span className="font-medium">Diagnosis:</span> {patient.diagnosis}
                                                </p>
                                            )}
                                            {patient.prescription && (
                                                <p className="text-sm text-blue-800 whitespace-pre-wrap">
                                                    <span className="font-medium">Prescription:</span> {patient.prescription}
                                                </p>
                                            )}
                                            {patient.notes && (
                                                <p className="text-sm text-blue-800 whitespace-pre-wrap">
                                                    <span className="font-medium">Notes:</span> {patient.notes}
                                                </p>
                                            )}
                                            {patient.follow_up_date && (
                                                <p className="text-sm text-blue-800">
                                                    <span className="font-medium">Follow-up:</span> {new Date(patient.follow_up_date).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    )}
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
