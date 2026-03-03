import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Clock, Filter } from 'lucide-react';
import { API } from '../config/api';

const STATUS_STYLES = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING: 'bg-orange-100 text-orange-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    CANCELLED: 'bg-red-100 text-red-700',
};

const AdminAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');

    useEffect(() => {
        fetch(`${API}/api/admin/appointments`)
            .then(res => res.json())
            .then(data => setAppointments(data))
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, []);

    const cancelAppointment = async (id) => {
        if (!window.confirm('Cancel this appointment?')) return;
        try {
            const res = await fetch(`${API}/api/appointments/${id}/cancel`, { method: 'PATCH' });
            if (!res.ok) {
                const err = await res.json();
                alert(err.message || 'Could not cancel');
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

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">All Appointments</h1>
                <p className="text-gray-500 mt-1">View every appointment across all doctors.</p>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center flex-wrap">
                <div className="relative flex-1 min-w-64">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search patient or doctor name..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED'].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/50'}`}>
                            {s === 'ALL' ? `All (${appointments.length})` : s}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center text-gray-400 animate-pulse py-10">Loading appointments...</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Doctor</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date & Time</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Symptoms</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(a => (
                                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-900 text-sm">{a.patient_first} {a.patient_last}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-medium text-gray-900 text-sm">Dr. {a.doctor_first} {a.doctor_last}</p>
                                        <p className="text-xs text-primary">{a.specialty}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col text-sm text-gray-600 gap-1">
                                            <span className="flex items-center gap-1"><Calendar size={12} />{new Date(a.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            <span className="flex items-center gap-1"><Clock size={12} />{a.time_slot}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        {a.symptoms ? (
                                            <div className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                                                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                                                <span className="line-clamp-2">{a.symptoms}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${STATUS_STYLES[a.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {a.status?.toLowerCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {a.status === 'CONFIRMED' && (
                                            <button
                                                onClick={() => cancelAppointment(a.id)}
                                                className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="py-12 text-center text-gray-400">No appointments found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminAppointments;
