import React, { useState, useEffect } from 'react';
import { Users, Calendar, Stethoscope, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API, authedHeaders } from '../config/api';

const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
    <button
        onClick={onClick}
        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-all text-left w-full group"
    >
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-4xl font-bold text-gray-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform`}>
            <Icon size={24} />
        </div>
    </button>
);

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ total_doctors: 0, total_patients: 0, today_appointments: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/api/admin/stats`, { headers: authedHeaders() })
            .then(res => res.json())
            .then(data => setStats(data))
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-500 mt-1">Overview of the hospital system.</p>
            </div>

            {isLoading ? (
                <div className="text-center text-gray-400 animate-pulse py-10">Loading stats...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                        title="Today's Appointments"
                        value={stats.today_appointments}
                        icon={Calendar}
                        color="bg-orange-50 text-orange-600"
                        onClick={() => navigate('/admin-appointments')}
                    />
                </div>
            )}

            <div className="grid sm:grid-cols-2 gap-6">
                <div
                    onClick={() => navigate('/admin-users')}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-primary-light text-primary rounded-xl"><Users size={24} /></div>
                        <h3 className="text-lg font-bold text-gray-900">Manage Users</h3>
                    </div>
                    <p className="text-gray-500 text-sm">Add or remove doctors and patients from the system.</p>
                </div>

                <div
                    onClick={() => navigate('/admin-appointments')}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Calendar size={24} /></div>
                        <h3 className="text-lg font-bold text-gray-900">All Appointments</h3>
                    </div>
                    <p className="text-gray-500 text-sm">View all appointments across all doctors with patient symptoms.</p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
