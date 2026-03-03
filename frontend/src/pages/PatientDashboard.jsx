import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, MapPin, Activity, FileText, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

const StatCard = ({ title, value, unit, icon: Icon, trend }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:shadow-md transition-shadow">
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
                <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
                {unit && <span className="text-sm text-gray-500">{unit}</span>}
            </div>
            {trend && (
                <p className={`text-xs mt-2 ${trend.isPositive ? 'text-green-600' : 'text-orange-500'}`}>
                    {trend.value} from last month
                </p>
            )}
        </div>
        <div className="p-3 bg-primary-light/50 text-primary rounded-xl group-hover:scale-110 transition-transform">
            <Icon size={24} />
        </div>
    </div>
);

const AppointmentCard = ({ date, time, doctor, specialty, location, status, onCancel }) => (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-primary/30 transition-colors cursor-pointer">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                    <img src={`https://ui-avatars.com/api/?name=${doctor.replace(' ', '+')}&background=random`} alt={doctor} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h4 className="font-semibold text-gray-900">{doctor}</h4>
                    <p className="text-sm text-gray-500">{specialty}</p>
                </div>
            </div>
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${status === 'Confirmed' ? 'bg-green-100 text-green-700' : status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                {status}
            </span>
        </div>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-2 text-gray-600">
                <CalendarIcon size={16} className="text-primary" />
                <span>{date}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
                <Clock size={16} className="text-primary" />
                <span>{time}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 col-span-2">
                <MapPin size={16} className="text-primary" />
                <span>{location}</span>
            </div>
        </div>
        {onCancel && (
            <button
                onClick={onCancel}
                className="mt-4 w-full py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
                Cancel Appointment
            </button>
        )}
    </div>
);

const PatientDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const res = await fetch(`${API}/api/patients/${user.id}/appointments`);
                const data = await res.json();
                setAppointments(data);
            } catch (err) {
                console.error('Dashboard error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user?.id]);

    const cancelAppointment = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
        try {
            const res = await fetch(`${API}/api/appointments/${id}/cancel`, { method: 'PATCH' });
            if (!res.ok) {
                const err = await res.json();
                alert(err.message || 'Could not cancel appointment');
                return;
            }
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'CANCELLED' } : a));
        } catch (err) {
            console.error('Cancel error:', err);
            alert('Failed to cancel appointment');
        }
    };

    if (isLoading) {
        return <div className="p-10 text-center text-gray-500 font-medium animate-pulse">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name}!</h1>
                    <p className="text-gray-500 mt-1">Here is your health summary for today.</p>
                </div>
                <button
                    onClick={() => navigate('/book')}
                    className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-primary/30"
                >
                    Book Appointment
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Blood Pressure" value="120/80" unit="mmHg" icon={Activity} trend={{ value: '-2%', isPositive: true }} />
                <StatCard title="Heart Rate" value="72" unit="bpm" icon={Activity} trend={{ value: 'Stable', isPositive: true }} />
                <StatCard title="Weight" value="75" unit="kg" icon={Activity} trend={{ value: '+1kg', isPositive: false }} />
                <StatCard title="Lab Reports" value="3" icon={FileText} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">Upcoming Appointments</h2>
                        <button className="text-primary text-sm font-medium hover:underline flex items-center">
                            View all <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6">
                        {appointments.length > 0 ? appointments.map((apt) => (
                            <AppointmentCard
                                key={apt.id}
                                doctor={`Dr. ${apt.doc_first} ${apt.doc_last}`}
                                specialty={apt.specialty}
                                date={new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                time={apt.time_slot}
                                location={apt.location_room}
                                status={apt.status.charAt(0).toUpperCase() + apt.status.slice(1).toLowerCase()}
                                onCancel={apt.status === 'CONFIRMED' ? () => cancelAppointment(apt.id) : null}
                            />
                        )) : (
                            <p className="text-gray-500 font-medium col-span-2">No upcoming appointments.</p>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-lg font-bold text-gray-900">Recent Medical History</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                        <div className="relative pl-6 border-l-2 border-primary/20 space-y-8">
                            <div className="relative">
                                <span className="absolute -left-[31px] bg-white border-2 border-primary w-4 h-4 rounded-full"></span>
                                <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Sep 15, 2026</p>
                                <h4 className="text-base font-medium text-gray-900 mt-1">Annual Checkup</h4>
                                <p className="text-sm text-gray-600 mt-1">Dr. Michael Chen</p>
                            </div>
                            <div className="relative">
                                <span className="absolute -left-[31px] bg-white border-2 border-gray-300 w-4 h-4 rounded-full"></span>
                                <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Jul 02, 2026</p>
                                <h4 className="text-base font-medium text-gray-900 mt-1">Blood Test</h4>
                                <p className="text-sm text-gray-600 mt-1">Normal hemoglobin levels.</p>
                            </div>
                        </div>
                        <button className="w-full py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            Download Full Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientDashboard;
