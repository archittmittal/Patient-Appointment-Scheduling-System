import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, AlertCircle, CheckCircle2, Activity, Users, RefreshCw, X, FileText, Pill, CalendarCheck, AlertTriangle, Thermometer, Scale, Ruler, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';
import { sseService } from '../services/sseService';
import EmergencyModal from '../components/EmergencyModal';

const QUEUE_POLL_INTERVAL = 20_000; // 20 seconds

const STATUS_COLORS = {
    WAITING: 'bg-amber-100/10 text-amber-500 border-amber-500/20',
    IN_PROGRESS: 'bg-indigo-100/10 text-indigo-500 border-indigo-500/20',
    COMPLETED: 'bg-emerald-100/10 text-emerald-500 border-emerald-500/20',
    MISSED: 'bg-rose-100/10 text-rose-500 border-rose-500/20',
};

const EMPTY_NOTES = { 
    diagnosis: '', 
    notes: '', 
    prescription: '', 
    follow_up_date: '',
    vitals: {
        weight_kg: '',
        height_cm: '',
        blood_pressure_sys: '',
        blood_pressure_dia: '',
        heart_rate: '',
        temperature_c: ''
    }
};

const SUGGESTED_DRUGS = [
    'Paracetamol 650mg',
    'Amoxicillin 500mg',
    'Ibuprofen 400mg',
    'Metformin 500mg',
    'Pantoprazole 40mg',
    'Cetirizine 10mg',
    'Azithromycin 500mg',
    'Atorvastatin 10mg',
    'Amlodipine 5mg',
    'Vitamin D3 60K'
];

const NotesModal = ({ item, onSave, onClose, saving }) => {
    const [form, setForm] = useState(EMPTY_NOTES);
    const [previousVitals, setPreviousVitals] = useState(null);
    const [loadingVitals, setLoadingVitals] = useState(true);
    const [rxRows, setRxRows] = useState([]);

    useEffect(() => {
        const fetchPrevious = async () => {
            const data = await apiClient.get(`/api/patients/${item.patient_id}/vitals`);
            if (Array.isArray(data) && data.length > 0) {
                const latest = data[data.length - 1];
                setPreviousVitals(latest);
                setForm(f => ({
                    ...f,
                    vitals: {
                        weight_kg: latest.weight_kg !== null && latest.weight_kg !== undefined ? String(latest.weight_kg) : '',
                        height_cm: latest.height_cm !== null && latest.height_cm !== undefined ? String(latest.height_cm) : '',
                        blood_pressure_sys: latest.blood_pressure_sys !== null && latest.blood_pressure_sys !== undefined ? String(latest.blood_pressure_sys) : '',
                        blood_pressure_dia: latest.blood_pressure_dia !== null && latest.blood_pressure_dia !== undefined ? String(latest.blood_pressure_dia) : '',
                        heart_rate: latest.heart_rate !== null && latest.heart_rate !== undefined ? String(latest.heart_rate) : '',
                        temperature_c: latest.temperature_c !== null && latest.temperature_c !== undefined ? String(latest.temperature_c) : ''
                    }
                }));
            }
            setLoadingVitals(false);
        };
        fetchPrevious();
    }, [item.patient_id]);

    const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    const changeVitals = e => {
        const { name, value } = e.target;
        setForm(f => ({
            ...f,
            vitals: { ...f.vitals, [name]: value }
        }));
    };

    const addRxRow = () => {
        setRxRows(prev => [
            ...prev,
            { name: '', frequency: '1-0-1', duration: '5', durationUnit: 'Days', instructions: 'After food', showSuggestions: false }
        ]);
    };

    const removeRxRow = (index) => {
        setRxRows(prev => prev.filter((_, i) => i !== index));
    };

    const updateRxRow = (index, field, value) => {
        setRxRows(prev => prev.map((row, i) => {
            if (i !== index) return row;
            const updated = { ...row, [field]: value };
            if (field === 'name') {
                updated.showSuggestions = value.trim().length > 0;
            }
            return updated;
        }));
    };

    const selectSuggestion = (index, drugName) => {
        setRxRows(prev => prev.map((row, i) => {
            if (i !== index) return row;
            return { ...row, name: drugName, showSuggestions: false };
        }));
    };

    const handleComplete = () => {
        const serialized = rxRows
            .filter(r => r.name.trim() !== '')
            .map(r => `${r.name.trim()} — ${r.frequency} for ${r.duration || 1} ${r.durationUnit} (${r.instructions})`)
            .join('\n');
        
        onSave({
            ...form,
            prescription: serialized || null
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="glass-modal rounded-[3rem] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-10 border-b border-[var(--border-base)] bg-primary-light/5 shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-[var(--text-base)] tracking-tight">Clinical Assessment</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Patient: <span className="text-primary font-bold">{item.first_name} {item.last_name}</span></p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-400 hover:text-[var(--text-base)] rounded-2xl hover:bg-white/10 transition-all active:scale-95">
                        <X size={20} strokeWidth={2.5} />
                    </button>
                </div>

                <div className="p-10 space-y-6 overflow-y-auto flex-1">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Current Diagnosis</label>
                        <div className="relative group">
                            <FileText size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                            <input
                                name="diagnosis"
                                value={form.diagnosis}
                                onChange={change}
                                placeholder="Enter clinical diagnosis..."
                                className="input-field pl-12"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Prescribed Medications (Rx)</label>
                            <button
                                type="button"
                                onClick={addRxRow}
                                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                                + Add Medicine
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {rxRows.map((rx, idx) => (
                                <div key={idx} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 space-y-3 relative group">
                                    <button
                                        type="button"
                                        onClick={() => removeRxRow(idx)}
                                        className="absolute right-4 top-4 text-slate-300 hover:text-rose-500 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                    
                                    <div className="grid grid-cols-12 gap-3 pr-6">
                                        <div className="col-span-12 relative">
                                            <input
                                                placeholder="Medicine Name (e.g. Paracetamol 650mg)"
                                                value={rx.name}
                                                onChange={e => updateRxRow(idx, 'name', e.target.value)}
                                                className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary/40 focus:bg-white"
                                            />
                                            {/* Simple Autocomplete Suggestions */}
                                            {rx.showSuggestions && rx.name && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-36 overflow-y-auto">
                                                    {SUGGESTED_DRUGS
                                                        .filter(d => d.toLowerCase().includes(rx.name.toLowerCase()))
                                                        .map(d => (
                                                            <button
                                                                key={d}
                                                                type="button"
                                                                onClick={() => selectSuggestion(idx, d)}
                                                                className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 font-medium"
                                                            >
                                                                {d}
                                                            </button>
                                                        ))
                                                    }
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="col-span-6">
                                            <select
                                                value={rx.frequency}
                                                onChange={e => updateRxRow(idx, 'frequency', e.target.value)}
                                                className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary/40"
                                            >
                                                <option value="1-0-0">1-0-0 (Morning)</option>
                                                <option value="0-1-0">0-1-0 (Afternoon)</option>
                                                <option value="0-0-1">0-0-1 (Night)</option>
                                                <option value="1-0-1">1-0-1 (Morning & Night)</option>
                                                <option value="1-1-1">1-1-1 (Thrice daily)</option>
                                                <option value="As needed (PRN)">As needed (PRN)</option>
                                            </select>
                                        </div>
                                        
                                        <div className="col-span-3 flex gap-1">
                                            <input
                                                type="number"
                                                placeholder="Qty"
                                                value={rx.duration}
                                                onChange={e => updateRxRow(idx, 'duration', e.target.value)}
                                                className="w-full bg-white border border-slate-200 px-2 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary/40 text-center"
                                            />
                                            <select
                                                value={rx.durationUnit}
                                                onChange={e => updateRxRow(idx, 'durationUnit', e.target.value)}
                                                className="bg-white border border-slate-200 px-1 py-2.5 rounded-xl text-[10px] font-semibold focus:outline-none focus:border-primary/40"
                                            >
                                                <option value="Days">Days</option>
                                                <option value="Weeks">Weeks</option>
                                                <option value="Months">Months</option>
                                            </select>
                                        </div>
                                        
                                        <div className="col-span-3">
                                            <select
                                                value={rx.instructions}
                                                onChange={e => updateRxRow(idx, 'instructions', e.target.value)}
                                                className="w-full bg-white border border-slate-200 px-2 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary/40"
                                            >
                                                <option value="After food">After food</option>
                                                <option value="Before food">Before food</option>
                                                <option value="With food">With food</option>
                                                <option value="Empty stomach">Empty stomach</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {rxRows.length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-4">No medications prescribed yet. Click + Add Medicine.</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Private Clinical Notes</label>
                        <div className="relative group">
                            <AlertCircle size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                            <textarea
                                name="notes"
                                value={form.notes}
                                onChange={change}
                                rows={3}
                                placeholder="Confidential observations..."
                                className="input-field pl-12 resize-none h-24"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Follow-up Window</label>
                        <div className="relative group">
                            <CalendarCheck size={18} className="absolute left-4 top-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                            <input
                                type="date"
                                name="follow_up_date"
                                value={form.follow_up_date}
                                onChange={change}
                                min={new Date().toISOString().split('T')[0]}
                                className="input-field pl-12"
                            />
                        </div>
                    </div>

                    {previousVitals && (
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Previous Vitals</p>
                                <p className="text-[10px] font-bold text-slate-400">{new Date(previousVitals.recorded_at).toLocaleDateString()}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs font-bold text-slate-900">{previousVitals.blood_pressure_sys}/{previousVitals.blood_pressure_dia}</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase">BP</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-900">{previousVitals.heart_rate} bpm</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase">Pulse</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-900">{previousVitals.temperature_c}°C</p>
                                    <p className="text-[9px] font-medium text-slate-400 uppercase">Temp</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-[var(--border-base)]/10">
                        <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Vitals Checklist</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative group">
                                <Scale size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    name="weight_kg"
                                    placeholder="Weight (kg)"
                                    value={form.vitals.weight_kg}
                                    onChange={changeVitals}
                                    className="input-field pl-12 py-3 text-sm"
                                    type="number"
                                />
                            </div>
                            <div className="relative group">
                                <Ruler size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    name="height_cm"
                                    placeholder="Height (cm)"
                                    value={form.vitals.height_cm}
                                    onChange={changeVitals}
                                    className="input-field pl-12 py-3 text-sm"
                                    type="number"
                                />
                            </div>
                            <div className="relative group">
                                <Activity size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                                <div className="flex gap-1 pl-12 pr-4 bg-[var(--bg-base)]/50 rounded-2xl border border-[var(--border-base)]/10">
                                    <input
                                        name="blood_pressure_sys"
                                        placeholder="SYS"
                                        value={form.vitals.blood_pressure_sys}
                                        onChange={changeVitals}
                                        className="w-full bg-transparent py-3 text-sm focus:outline-none"
                                        type="number"
                                    />
                                    <span className="text-slate-400 py-3">/</span>
                                    <input
                                        name="blood_pressure_dia"
                                        placeholder="DIA"
                                        value={form.vitals.blood_pressure_dia}
                                        onChange={changeVitals}
                                        className="w-full bg-transparent py-3 text-sm focus:outline-none"
                                        type="number"
                                    />
                                </div>
                            </div>
                            <div className="relative group">
                                <Thermometer size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" />
                                <input
                                    name="temperature_c"
                                    placeholder="Temp (°C)"
                                    value={form.vitals.temperature_c}
                                    onChange={changeVitals}
                                    className="input-field pl-12 py-3 text-sm"
                                    type="number"
                                    step="0.1"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 p-10 border-t border-[var(--border-base)] bg-primary-light/5 shrink-0">
                    <button onClick={onClose} className="btn-secondary flex-1 font-bold">Discard</button>
                    <button
                        onClick={handleComplete}
                        disabled={saving}
                        className="btn-primary flex-1 font-bold shadow-xl shadow-primary/20 disabled:opacity-60"
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
    const navigate = useNavigate();
    const [patients, setPatients] = useState([]);
    const [queue, setQueue] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('queue');
    const [updatingId, setUpdatingId] = useState(null);
    const [queueLastUpdated, setQueueLastUpdated] = useState(null);
    const [notesModal, setNotesModal] = useState(null);

    // Issue #40: Delay propagation state
    const [delayInfo, setDelayInfo] = useState({ isDelayed: false, delayMins: 0, reason: '' });
    const [showDelayModal, setShowDelayModal] = useState(false);
    const [delayForm, setDelayForm] = useState({ minutes: 15, reason: '' });
    const [settingDelay, setSettingDelay] = useState(false);
    const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);

    const [dismissedOverrun, setDismissedOverrun] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [doctorAvailability, setDoctorAvailability] = useState(null);

    useEffect(() => {
        const active = queue.find(item => item.queue_status === 'IN_PROGRESS');
        if (!active || !active.consultation_start) {
            setElapsedSeconds(0);
            setDismissedOverrun(false);
            return;
        }

        const start = new Date(active.consultation_start).getTime();
        const updateElapsed = () => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((now - start) / 1000));
            setElapsedSeconds(diff);
        };
        
        updateElapsed();
        const timer = setInterval(updateElapsed, 1000);
        return () => clearInterval(timer);
    }, [queue]);

    const propagateAutoDelay = async () => {
        if (!user?.id) return;
        try {
            await apiClient.post(`/api/doctors/${user.id}/delay`, {
                delayMins: 10,
                reason: 'Consultation overrun'
            });
            setDelayInfo({ isDelayed: true, delayMins: 10, reason: 'Consultation overrun' });
            setDismissedOverrun(true);
        } catch (err) {
            console.error('Failed to propagate auto-delay:', err);
        }
    };

    const fetchData = async () => {
        if (!user?.id) return;
        try {
            const [patientsData, queueData, delayData, doctorProfile] = await Promise.all([
                apiClient.get(`/api/doctors/${user.id}/patients`),
                apiClient.get(`/api/doctors/${user.id}/queue`),
                apiClient.get(`/api/doctors/${user.id}/delay-status`),
                apiClient.get(`/api/doctors/${user.id}`).catch(() => null)
            ]);
            setPatients(patientsData?.data || patientsData || []);
            setQueue(queueData);
            setQueueLastUpdated(new Date());

            if (delayData && !delayData.error) {
                setDelayInfo({
                    isDelayed: delayData.isDelayed || false,
                    delayMins: delayData.delayMins || 0,
                    reason: delayData.reason || ''
                });
            }

            if (doctorProfile && doctorProfile.availability) {
                try {
                    const av = typeof doctorProfile.availability === 'string'
                        ? JSON.parse(doctorProfile.availability)
                        : doctorProfile.availability;
                    setDoctorAvailability(av);
                } catch (e) {
                    console.error('Error parsing doctor availability:', e);
                }
            }
        } catch (err) {
            console.error('Doctor dashboard error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getCurrentDayAvailabilityString = () => {
        if (!doctorAvailability) return '08:00 AM — 05:00 PM'; // Fallback default
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = dayNames[new Date().getDay()];
        const dayAvail = doctorAvailability[currentDay];
        if (!dayAvail || !dayAvail.open || !dayAvail.from || !dayAvail.to) {
            return 'Closed today';
        }
        
        const formatTime12 = (timeStr) => {
            if (!timeStr) return '';
            const [hourStr, minStr] = timeStr.split(':');
            let hour = parseInt(hourStr, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            hour = hour ? hour : 12;
            const hourFormatted = String(hour).padStart(2, '0');
            return `${hourFormatted}:${minStr} ${ampm}`;
        };

        return `${formatTime12(dayAvail.from)} — ${formatTime12(dayAvail.to)}`;
    };

    const handleSetDelay = async () => {
        if (!user?.id) return;
        setSettingDelay(true);
        try {
            const data = await apiClient.post(`/api/doctors/${user.id}/delay`, {
                delayMins: delayForm.minutes,
                reason: delayForm.reason || 'Surgical emergency'
            });
            if (data && !data.error) {
                setDelayInfo({ isDelayed: true, delayMins: delayForm.minutes, reason: delayForm.reason || 'Surgical emergency' });
                setShowDelayModal(false);
            }
        } finally {
            setSettingDelay(false);
        }
    };

    const handleClearDelay = async () => {
        if (!user?.id) return;
        setSettingDelay(true);
        try {
            await apiClient.post(`/api/doctors/${user.id}/delay`, { delayMins: 0, reason: '' });
            setDelayInfo({ isDelayed: false, delayMins: 0, reason: '' });
        } finally {
            setSettingDelay(false);
        }
    };

    const downloadPDF = async (apptId) => {
        try {
            const blob = await apiClient.getBlob(`/api/appointments/${apptId}/prescription/pdf`);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `prescription_${apptId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download prescription PDF.');
        }
    };

    useEffect(() => { fetchData(); }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        // Establish real-time SSE stream for the doctor's queue
        sseService.connectDoctor(
            user.id,
            (data) => {
                console.log('[SSE] Doctor queue update received:', data);
                fetchData(); // Trigger immediate refresh when updated
            },
            () => console.warn('[SSE] Doctor neural sync connection lost')
        );

        return () => sseService.disconnect();
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        const interval = setInterval(async () => {
            const data = await apiClient.get(`/api/doctors/${user.id}/queue`);
            setQueue(data);
            setQueueLastUpdated(new Date());
        }, QUEUE_POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [user?.id]);

    const updateQueueStatus = async (queueId, newStatus, extra = {}) => {
        setUpdatingId(queueId);
        try {
            await apiClient.patch(`/api/appointments/queue/${queueId}/status`, { status: newStatus, ...extra });
            setQueue(prev => prev.map(q => q.queue_id === queueId ? { ...q, queue_status: newStatus } : q));
        } catch (err) {
            console.error('Failed to update queue status:', err);
            const errMsg = err.response?.data?.message || err.message || 'Failed to update status. Please check your clinical inputs.';
            alert(errMsg);
            throw err;
        } finally { setUpdatingId(null); }
    };

    if (isLoading) return <div className="p-10 text-center text-slate-500 animate-pulse font-bold">Synchronizing Clinical Data...</div>;

    return (
        <div className="space-y-8 pb-10 animate-in fade-in duration-700">
            {notesModal && (
                <NotesModal
                    item={notesModal.item}
                    saving={updatingId === notesModal.queueId}
                    onSave={async (form) => {
                        // Clean up form to match backend schemas and convert blank strings to appropriate types
                        const cleanedForm = { ...form };
                        if (cleanedForm.diagnosis === '') cleanedForm.diagnosis = null;
                        if (cleanedForm.notes === '') cleanedForm.notes = null;
                        if (cleanedForm.prescription === '') cleanedForm.prescription = null;
                        if (cleanedForm.follow_up_date === '') cleanedForm.follow_up_date = null;

                        if (cleanedForm.vitals) {
                            const cleanedVitals = {};
                            let hasVitals = false;
                            Object.entries(cleanedForm.vitals).forEach(([key, val]) => {
                                if (val !== '' && val !== null && val !== undefined) {
                                    cleanedVitals[key] = Number(val);
                                    hasVitals = true;
                                }
                            });
                            cleanedForm.vitals = hasVitals ? cleanedVitals : null;
                        }

                        try {
                            await updateQueueStatus(notesModal.queueId, 'COMPLETED', cleanedForm);
                            setNotesModal(null);
                            fetchData();
                        } catch (err) {
                            console.error('Modal save failed:', err);
                        }
                    }}
                    onClose={() => setNotesModal(null)}
                />
            )}

            {/* Delay Modal */}
            {showDelayModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="glass-modal rounded-[3rem] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 border-b border-[var(--border-base)] bg-primary-light/5">
                            <h3 className="text-2xl font-black text-[var(--text-base)] tracking-tight">Active Delay</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">Broadcast schedule lag to all patients.</p>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Time Lag (Mins)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[15, 30, 45, 60, 90, 120].map(mins => (
                                        <button
                                            key={mins}
                                            onClick={() => setDelayForm(f => ({ ...f, minutes: mins }))}
                                            className={`py-3 rounded-2xl text-xs font-black transition-all duration-300 border ${delayForm.minutes === mins
                                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                                    : 'bg-white/5 text-slate-500 border-[var(--border-base)] hover:border-primary/50'
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
                                    placeholder="e.g. Case overflow, Surgical priority..."
                                    className="input-field"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 p-10 border-t border-[var(--border-base)] bg-primary-light/5">
                            <button onClick={() => setShowDelayModal(false)} className="btn-secondary flex-1 font-bold">Discard</button>
                            <button
                                onClick={handleSetDelay}
                                disabled={settingDelay}
                                className="btn-primary flex-1 font-bold shadow-xl shadow-primary/20"
                            >
                                {settingDelay ? 'Syncing...' : 'Propagate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tight">
                        Daily <span className="text-primary ">Ops</span> Center
                    </h1>
                    <p className="text-slate-500 font-bold mt-2 flex items-center gap-2">
                        <Activity size={16} className="text-primary" />
                        Dr. {user?.last_name} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <button
                        onClick={() => setIsEmergencyOpen(true)}
                        className="btn-primary bg-danger hover:bg-red-700 border-none px-6"
                    >
                        <AlertCircle size={18} strokeWidth={2.5} /> Emergency Override
                    </button>

                    <button
                        onClick={() => setShowDelayModal(true)}
                        className="btn-secondary px-6 flex items-center gap-2"
                    >
                        <Clock size={18} strokeWidth={2.5} /> Report Delay
                    </button>

                    <button
                        onClick={() => navigate('/doctor-analytics')}
                        className="btn-secondary px-6 flex items-center gap-2"
                    >
                        <BarChart3 size={18} strokeWidth={2.5} /> Analytics
                    </button>

                    <div className="glass-card p-4 flex items-center gap-4 border-primary/10">
                        <div className="w-12 h-12 rounded-2xl bg-primary-light/30 flex items-center justify-center text-primary shadow-inner">
                            <Calendar size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Schedule</p>
                            <p className="text-base font-black text-[var(--text-base)]">{getCurrentDayAvailabilityString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delay Banner */}
            {delayInfo.isDelayed && (
                <div className="glass-card border-amber-500/30 bg-amber-500/5 p-6 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                            <AlertTriangle size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-lg font-black text-amber-500 tracking-tight">Workflow Lag Detected — {delayInfo.delayMins}m</p>
                            <p className="text-sm text-slate-500 font-bold mt-0.5">{delayInfo.reason || 'Service congestion reported.'}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClearDelay}
                        disabled={settingDelay}
                        className="btn-secondary py-3 px-8 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 font-black text-xs uppercase tracking-widest"
                    >
                        {settingDelay ? 'Clearing...' : 'Resolve Delay'}
                    </button>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<Users size={24} />} label="Patient Registry" value={patients.length} color="indigo" tag="Total" />
                <StatCard icon={<Calendar size={24} />} label="Daily Queue" value={queue.length} color="emerald" tag="Today" />
                <StatCard icon={<Activity size={24} />} label="Live Sessions" value={queue.filter(q => q.queue_status === 'IN_PROGRESS').length} color="sky" tag="Active" />

                <button
                    onClick={() => !delayInfo.isDelayed && setShowDelayModal(true)}
                    className={`glass-card p-6 text-left group transition-all duration-300 hover:translate-y-[-4px] ${delayInfo.isDelayed ? 'border-amber-500/30' : ''}`}
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${delayInfo.isDelayed ? 'bg-amber-500/20 text-amber-500 shadow-lg shadow-amber-500/10' : 'bg-slate-500/10 text-slate-400 group-hover:bg-primary group-hover:text-white'}`}>
                            <Clock size={24} strokeWidth={2.5} />
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${delayInfo.isDelayed ? 'bg-amber-500/10 text-amber-500' : 'bg-white/5 text-slate-400'}`}>
                            {delayInfo.isDelayed ? 'Delay Active' : 'Configure'}
                        </span>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Delay</p>
                    <h3 className={`text-4xl font-black mt-1 tracking-tighter ${delayInfo.isDelayed ? 'text-amber-500' : 'text-slate-300'}`}>
                        {delayInfo.isDelayed ? `${delayInfo.delayMins}m` : '0m'}
                    </h3>
                </button>
            </div>

            {/* Content Tabs */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--border-base)] pt-4">
                    <div className="flex gap-10">
                        {['queue', 'patients'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 px-1 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {tab === 'queue' ? 'Live Queue' : 'Patient History'}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                            </button>
                        ))}
                    </div>
                    {activeTab === 'queue' && queueLastUpdated && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4">
                            <RefreshCw size={12} className="text-primary animate-spin-slow" />
                            Synced {queueLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>

                {activeTab === 'queue' ? (
                    <div className="grid gap-4">
                        {queue.length === 0 ? (
                            <div className="glass-card p-20 text-center border-dashed">
                                <Calendar size={48} className="mx-auto text-slate-300 mb-4 opacity-20" />
                                <p className="text-slate-500 font-bold">No clinical sessions queued for today.</p>
                            </div>
                        ) : (
                            queue.map(item => {
                                const elapsedMins = Math.floor(elapsedSeconds / 60);
                                const elapsedSecs = elapsedSeconds % 60;
                                const timeStr = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`;
                                const isOverrun = elapsedMins >= 15;

                                return (
                                    <div key={item.queue_id} className={`glass-card p-6 flex flex-col gap-4 group transition-all duration-300 hover:border-primary/20 ${item.queue_status === 'IN_PROGRESS' && isOverrun && !dismissedOverrun ? 'border-amber-500/30' : ''}`}>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600/10 text-primary flex flex-col items-center justify-center border border-indigo-600/20 group-hover:scale-105 transition-transform shadow-inner">
                                                    <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">Pos</span>
                                                    <span className="text-2xl font-black">{item.queue_number}</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black text-[var(--text-base)] tracking-tight">{item.first_name} {item.last_name}</h4>
                                                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                                        <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                                                            <Clock size={14} className="text-primary" /> {item.time_slot}
                                                        </p>
                                                        <span className={`px-3 py-0.5 text-[9px] font-black rounded-lg border uppercase tracking-widest ${STATUS_COLORS[item.queue_status]}`}>
                                                            {item.queue_status?.replace('_', ' ')}
                                                        </span>
                                                        
                                                        {item.queue_status === 'IN_PROGRESS' && (
                                                            <span className={`px-3 py-0.5 text-[9px] font-black rounded-lg border uppercase tracking-widest ${isOverrun ? 'bg-rose-500/10 text-rose-500 border-rose-500/25 animate-pulse' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'}`}>
                                                                ⏱️ Session: {timeStr} {isOverrun ? '(Overrun)' : ''}
                                                            </span>
                                                        )}

                                                        {/* Check-in Progress Badges */}
                                                        {item.virtual_checkin_status === 'CHECKED_IN' && (
                                                            <span className="px-3 py-0.5 text-[9px] font-black rounded-lg border uppercase tracking-widest bg-indigo-500/10 text-indigo-500 border-indigo-500/25 shadow-sm shadow-indigo-500/5">
                                                                📡 Remote Checked-In
                                                            </span>
                                                        )}
                                                        {item.virtual_checkin_status === 'EN_ROUTE' && (
                                                            <span className="px-3 py-0.5 text-[9px] font-black rounded-lg border uppercase tracking-widest bg-amber-500/10 text-amber-500 border-amber-500/25 shadow-sm shadow-amber-500/5">
                                                                🚗 En Route • {item.patient_eta_minutes || 15}m ETA
                                                            </span>
                                                        )}
                                                        {item.virtual_checkin_status === 'ARRIVED' && (
                                                            <span className="px-3 py-0.5 text-[9px] font-black rounded-lg border uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border-emerald-500/25 shadow-sm shadow-amber-500/5 animate-pulse">
                                                                🏥 Arrived at Clinic
                                                            </span>
                                                        )}
                                                        {(!item.virtual_checkin_status || item.virtual_checkin_status === 'NOT_CHECKED_IN') && (
                                                            <span className="px-3 py-0.5 text-[9px] font-black rounded-lg border uppercase tracking-widest bg-slate-500/5 text-slate-400 border-slate-500/10">
                                                                👤 Standard Check-In
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {item.queue_status === 'WAITING' && (
                                                    <button onClick={() => updateQueueStatus(item.queue_id, 'IN_PROGRESS')} className="btn-primary py-2.5 shadow-lg shadow-indigo-500/20">Initiate Session</button>
                                                )}
                                                {item.queue_status === 'IN_PROGRESS' && (
                                                    <button onClick={() => setNotesModal({ queueId: item.queue_id, item })} className="btn-primary py-2.5 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20">Complete Analysis</button>
                                                )}
                                                {item.queue_status === 'WAITING' && (
                                                    <button onClick={() => updateQueueStatus(item.queue_id, 'MISSED')} className="btn-secondary py-2.5 border-rose-500/20 text-rose-500 hover:bg-rose-500/10">Missed</button>
                                                )}
                                            </div>
                                        </div>

                                        {item.queue_status === 'IN_PROGRESS' && isOverrun && !dismissedOverrun && (
                                            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300 w-full shrink-0">
                                                <div className="flex items-center gap-3">
                                                    <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                                                    <div className="text-left">
                                                        <p className="text-xs font-black text-amber-500 uppercase tracking-wider">Consultation Running Late</p>
                                                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Would you like to propagate a 10-minute delay to subsequent patients?</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 w-full md:w-auto">
                                                    <button
                                                        onClick={propagateAutoDelay}
                                                        className="flex-1 md:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-lg shadow-amber-500/10"
                                                    >
                                                        Yes, Propagate
                                                    </button>
                                                    <button
                                                        onClick={() => setDismissedOverrun(true)}
                                                        className="flex-1 md:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {patients.map((p, idx) => (
                            <div key={`${p.appointment_id}-${idx}`} className="glass-card p-8 group hover:border-primary/20 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-all">
                                            <User size={28} />
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-[var(--text-base)] tracking-tight">
                                                {p.first_name} {p.last_name}
                                                <span className="text-xs font-medium text-slate-400 ml-3">ID: PAT-{p.patient_id}</span>
                                            </h4>
                                            <div className="flex items-center gap-6 mt-2">
                                                <span className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest"><Calendar size={14} className="text-primary" />{new Date(p.appointment_date).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest"><Clock size={14} className="text-primary" />{p.time_slot}</span>
                                                {p.blood_group && <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-3 py-1 rounded-lg uppercase tracking-widest border border-rose-500/20">Type {p.blood_group}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {p.status === 'COMPLETED' && (
                                            <button 
                                                onClick={() => downloadPDF(p.appointment_id)}
                                                className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border border-primary/20 text-primary hover:bg-primary/5 transition-all flex items-center gap-1.5"
                                            >
                                                OPD Slip
                                            </button>
                                        )}
                                        <span className={`px-4 py-1.5 text-[10px] font-black rounded-full border uppercase tracking-widest ${p.status === 'COMPLETED' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Emergency Modal */}
            <EmergencyModal
                isOpen={isEmergencyOpen}
                onClose={() => setIsEmergencyOpen(false)}
                onSuccess={() => {
                    fetchData();
                }}
            />
        </div>
    );
};

const StatCard = ({ icon, label, value, color, tag }) => (
    <div className="glass-card p-6 group transition-all duration-300 hover:translate-y-[-4px]">
        <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl bg-${color}-500/10 text-${color}-500 flex items-center justify-center group-hover:bg-${color}-500 group-hover:text-white transition-all duration-500 shadow-inner`}>
                {icon}
            </div>
            <span className={`text-[10px] font-black text-${color}-500 bg-${color}-500/10 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-${color}-500/10`}>{tag}</span>
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <h3 className="text-4xl font-black text-[var(--text-base)] mt-1 tracking-tighter">{value}</h3>
    </div>
);

export default DoctorDashboard;
