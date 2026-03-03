import React, { useState, useEffect, useCallback } from 'react';
import { Users, Calendar, Stethoscope, CheckCircle, Clock, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API, authedHeaders } from '../config/api';

const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
    <button
        onClick={onClick}
        className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-all text-left w-full group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform`}>
            <Icon size={22} />
        </div>
    </button>
);

const QueueBadge = ({ label, count, bg, text }) => (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg ${bg}`}>
        <span className={`text-lg font-bold ${text}`}>{count}</span>
        <span className={`text-xs font-medium ${text} opacity-80`}>{label}</span>
    </div>
);

const DoctorQueueCard = ({ data }) => {
    const total = data.waiting + data.in_progress + data.completed + data.missed;
    const completedPct = total > 0 ? Math.round((data.completed / total) * 100) : 0;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h4 className="font-bold text-gray-900">{data.doctor_name}</h4>
                    <p className="text-sm text-gray-500">{data.specialty}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {data.total_today} today
                </span>
            </div>

            <div className="flex gap-2 mb-4">
                <QueueBadge label="Waiting"  count={data.waiting}     bg="bg-yellow-50"  text="text-yellow-700" />
                <QueueBadge label="Active"   count={data.in_progress} bg="bg-blue-50"    text="text-blue-700" />
                <QueueBadge label="Done"     count={data.completed}   bg="bg-green-50"   text="text-green-700" />
                <QueueBadge label="Missed"   count={data.missed}      bg="bg-red-50"     text="text-red-600" />
            </div>

            {total > 0 && (
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{completedPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${completedPct}%` }}
                        />
                    </div>
                </div>
            )}

            {data.queue.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {data.queue.map(q => (
                        <div key={q.queue_id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600">
                                    #{q.queue_number}
                                </span>
                                <span className="text-gray-700 font-medium">{q.patient_name}</span>
                                {q.time_slot && (
                                    <span className="text-gray-400 text-xs">{q.time_slot}</span>
                                )}
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                q.queue_status === 'WAITING'     ? 'bg-yellow-100 text-yellow-700' :
                                q.queue_status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                q.queue_status === 'COMPLETED'   ? 'bg-green-100 text-green-700' :
                                                                   'bg-red-100 text-red-600'
                            }`}>
                                {q.queue_status === 'IN_PROGRESS' ? 'Active' : q.queue_status.charAt(0) + q.queue_status.slice(1).toLowerCase()}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {data.queue.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No queue entries yet today</p>
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

    useEffect(() => {
        fetch(`${API}/api/admin/stats`, { headers: authedHeaders() })
            .then(r => r.json())
            .then(data => setStats(data))
            .catch(err => console.error(err))
            .finally(() => setStatsLoading(false));
    }, []);

    const fetchQueue = useCallback(() => {
        fetch(`${API}/api/admin/queue-overview`, { headers: authedHeaders() })
            .then(r => r.json())
            .then(data => {
                setQueueData(Array.isArray(data) ? data : []);
                setLastUpdated(new Date());
            })
            .catch(err => console.error(err))
            .finally(() => setQueueLoading(false));
    }, []);

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 20000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-500 mt-1">Overview of the hospital system.</p>
            </div>

            {/* Overall stats */}
            <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Overall</h2>
                {statsLoading ? (
                    <div className="text-center text-gray-400 animate-pulse py-6">Loading stats...</div>
                ) : stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard
                            title="Total Doctors"
                            value={stats.total_doctors}
                            icon={Stethoscope}
                            color="bg-blue-50 text-blue-600"
                            onClick={() => navigate('/admin-users')}
                        />
                        <StatCard
                            title="Total Patients"
                            value={stats.total_patients}
                            icon={Users}
                            color="bg-green-50 text-green-600"
                            onClick={() => navigate('/admin-users')}
                        />
                        <StatCard
                            title="All Appointments"
                            value={stats.total_appointments}
                            icon={Calendar}
                            color="bg-purple-50 text-purple-600"
                            onClick={() => navigate('/admin-appointments')}
                        />
                    </div>
                )}
            </section>

            {/* Today's breakdown */}
            <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Today's Appointments</h2>
                {statsLoading ? (
                    <div className="text-center text-gray-400 animate-pulse py-6">Loading...</div>
                ) : stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Today"
                            value={stats.today_total ?? 0}
                            icon={Activity}
                            color="bg-orange-50 text-orange-600"
                            onClick={() => navigate('/admin-appointments')}
                        />
                        <StatCard
                            title="Confirmed"
                            value={stats.today_confirmed ?? 0}
                            icon={CheckCircle}
                            color="bg-blue-50 text-blue-600"
                        />
                        <StatCard
                            title="Completed"
                            value={stats.today_completed ?? 0}
                            icon={CheckCircle}
                            color="bg-green-50 text-green-600"
                        />
                        <StatCard
                            title="Pending"
                            value={stats.today_pending ?? 0}
                            icon={Clock}
                            color="bg-yellow-50 text-yellow-600"
                        />
                    </div>
                )}
            </section>

            {/* Top doctors today */}
            {stats?.top_doctors_today?.length > 0 && (
                <section>
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Top Doctors Today</h2>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">Doctor</th>
                                    <th className="px-4 py-3 text-left">Specialty</th>
                                    <th className="px-4 py-3 text-right">Appointments</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.top_doctors_today.map(d => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-800">Dr. {d.first_name} {d.last_name}</td>
                                        <td className="px-4 py-3 text-gray-500">{d.specialty}</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-800">{d.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Live queue overview (A3) */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Today's Live Queue</h2>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                        {lastUpdated
                            ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                            : 'Refreshing every 20s'}
                    </div>
                </div>

                {queueLoading ? (
                    <div className="text-center text-gray-400 animate-pulse py-10">Loading queue data...</div>
                ) : queueData.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
                        No appointments scheduled for today yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {queueData.map(d => (
                            <DoctorQueueCard key={d.doctor_id} data={d} />
                        ))}
                    </div>
                )}
            </section>

            {/* Quick actions */}
            <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Actions</h2>
                <div className="grid sm:grid-cols-2 gap-5">
                    <div
                        onClick={() => navigate('/admin-users')}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-primary-light text-primary rounded-xl"><Users size={22} /></div>
                            <h3 className="text-lg font-bold text-gray-900">Manage Users</h3>
                        </div>
                        <p className="text-gray-500 text-sm">Add or remove doctors and patients from the system.</p>
                    </div>

                    <div
                        onClick={() => navigate('/admin-appointments')}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                    >
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Calendar size={22} /></div>
                            <h3 className="text-lg font-bold text-gray-900">All Appointments</h3>
                        </div>
                        <p className="text-gray-500 text-sm">View all appointments across all doctors with patient symptoms.</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AdminDashboard;
