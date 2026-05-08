import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { X, Search, AlertCircle, User, Activity, Clock } from 'lucide-react';

const EmergencyModal = ({ isOpen, onClose, onSuccess }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [reason, setReason] = useState('');
    const [symptoms, setSymptoms] = useState('');
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchDoctors();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            resetForm();
        }
    }, [isOpen]);

    const fetchDoctors = async () => {
        const data = await apiClient.get('/api/doctors');
        if (data && !data.error) setDoctors(data);
    };

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (val.length < 2) {
            setPatients([]);
            return;
        }

        setSearching(true);
        const data = await apiClient.get(`/api/admin/patients/search?q=${encodeURIComponent(val)}`);
        if (data && !data.error) setPatients(data);
        setSearching(false);
    };

    const resetForm = () => {
        setSearchQuery('');
        setPatients([]);
        setSelectedPatient(null);
        setSelectedDoctor('');
        setReason('');
        setSymptoms('');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedPatient || !selectedDoctor) {
            setError('Please select both a patient and a doctor.');
            return;
        }

        setLoading(true);
        setError('');

        const data = await apiClient.post('/api/walkin/register', {
            overridePatientId: selectedPatient.id,
            doctorId: selectedDoctor,
            urgencyLevel: 'EMERGENCY',
            reason: reason || 'Emergency triage override',
            symptoms: symptoms || 'Immediate medical attention required',
            vitalSigns: {} // Optional for now
        });

        setLoading(false);

        if (data && data.error) {
            setError(data.message || 'Failed to register emergency.');
        } else {
            onSuccess?.(data);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="glass-modal w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-base)] flex items-center justify-between bg-danger/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-danger/10 text-danger rounded-xl">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <h2 className="text-h3 font-bold text-danger">Emergency Override</h2>
                            <p className="text-caption text-slate-500">Bypass queue for immediate critical care</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Patient Search */}
                    <div className="space-y-2">
                        <label className="text-caption font-bold text-slate-500 uppercase flex items-center gap-2">
                            <User size={14} /> Search Patient
                        </label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                className="input-field pl-12"
                                placeholder="Name or Phone number..."
                                value={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : searchQuery}
                                onChange={(e) => !selectedPatient && handleSearch(e.target.value)}
                                disabled={!!selectedPatient}
                            />
                            {selectedPatient && (
                                <button 
                                    type="button"
                                    onClick={() => { setSelectedPatient(null); setSearchQuery(''); setPatients([]); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary hover:text-primary-hover font-semibold text-sm"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                        
                        {!selectedPatient && searchQuery.length >= 2 && (
                            <div className="mt-2 glass-card overflow-hidden max-h-48 overflow-y-auto">
                                {searching ? (
                                    <div className="p-4 text-center text-slate-500">Searching...</div>
                                ) : patients.length > 0 ? (
                                    patients.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setSelectedPatient(p)}
                                            className="w-full p-4 text-left hover:bg-primary/5 border-b border-[var(--border-base)] last:border-0 transition-colors"
                                        >
                                            <div className="font-semibold">{p.first_name} {p.last_name}</div>
                                            <div className="text-caption text-slate-500">{p.phone} • {p.blood_group || 'N/A'}</div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-slate-500">No patients found</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Doctor Selection */}
                        <div className="space-y-2">
                            <label className="text-caption font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Activity size={14} /> Assign Doctor
                            </label>
                            <select
                                className="input-field appearance-none"
                                value={selectedDoctor}
                                onChange={(e) => setSelectedDoctor(e.target.value)}
                                required
                            >
                                <option value="">Select Doctor...</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>
                                        Dr. {d.first_name} {d.last_name} ({d.specialty})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Reason / Category */}
                        <div className="space-y-2">
                            <label className="text-caption font-bold text-slate-500 uppercase flex items-center gap-2">
                                <Clock size={14} /> Urgency Category
                            </label>
                            <select
                                className="input-field"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            >
                                <option value="">Select Reason...</option>
                                <option value="Cardiac Arrest">Cardiac Arrest</option>
                                <option value="Severe Trauma">Severe Trauma</option>
                                <option value="Respiratory Distress">Respiratory Distress</option>
                                <option value="Unconscious">Unconscious</option>
                                <option value="Other Critical">Other Critical</option>
                            </select>
                        </div>
                    </div>

                    {/* Symptoms Textarea */}
                    <div className="space-y-2">
                        <label className="text-caption font-bold text-slate-500 uppercase">
                            Clinical Observations / Symptoms
                        </label>
                        <textarea
                            className="input-field min-h-[100px] resize-none"
                            placeholder="Describe current status..."
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-danger/10 text-danger rounded-2xl flex items-center gap-3">
                            <AlertCircle size={20} />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex-1 bg-danger hover:bg-red-700"
                        >
                            {loading ? 'Processing...' : 'Register Emergency'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EmergencyModal;
