import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, AlertCircle, CheckCircle2, Activity, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

const STATUS_COLORS = {
    WAITING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
    COMPLETED: 'bg-green-100 text-green-700 border-green-200',
    MISSED: 'bg-red-100 text-red-700 border-red-200',
};

const NEXT_STATUS = {
    WAITING: 'IN_PROGRESS',
    IN_PROGRESS: 'COMPLETED',
    COMPLETED: null,
    MISSED: null,
};

const NEXT_LABEL = {
    WAITING: 'Start',
    IN_PROGRESS: 'Complete',
    COMPLETED: null,
    MISSED: null,
};

const DoctorDashboard = () => {
    const { user } = useAuth();
    const [patients, setPatients] = useState([]);
    const [queue, setQueue] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('queue');
    const [updatingId, setUpdatingId] = useState(null);

    const fetchData = async () => {
        if (!user?.id) return;
        try {
            const [patientsRes, queueRes] = await Promise.all([
                fetch(`${API}/api/doctors/${user.id}/patients`),
                fetch(`${API}/api/doctors/${user.id}/queue`)
            ]);
            const patientsData = await patientsRes.json();
            const queueData = await queueRes.json();
            setPatients(patientsData);
            setQueue(queueData);
        } catch (err) {
            console.error('Doctor dashboard error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user?.id]);

    const updateQueueStatus = async (queueId, newStatus) => {
        setUpdatingId(queueId);
        try {
            await fetch(`${API}/api/appointments/queue/${queueId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            setQueue(prev => prev.map(q => q.queue_id === queueId ? { ...q, queue_status: newStatus } : q));
        } catch (err) {
            console.error('Queue update error:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const markMissed = async (queueId) => {
        setUpdatingId(queueId);
        try {
            await fetch(`${API}/api/appointments/queue/${queueId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
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
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dr. {user?.first_name} {user?.last_name}'s Dashboard</h1>
                <p className="text-gray-500 mt-1">Manage your patients and today's queue.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
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
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200">
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
                                        {NEXT_STATUS[item.queue_status] && (
                                            <button
                                                disabled={updatingId === item.queue_id}
                                                onClick={() => updateQueueStatus(item.queue_id, NEXT_STATUS[item.queue_status])}
                                                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                                            >
                                                {updatingId === item.queue_id ? '...' : NEXT_LABEL[item.queue_status]}
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
                                                <AlertCircle size={12} /> Pre-diagnosed Symptoms
                                            </p>
                                            <p className="text-sm text-amber-800">{patient.symptoms}</p>
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
