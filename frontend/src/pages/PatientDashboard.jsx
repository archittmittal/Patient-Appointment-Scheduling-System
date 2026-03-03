import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

const STATUS_STYLES = {
    CONFIRMED: 'bg-green-100 text-green-700',
    PENDING:   'bg-orange-100 text-orange-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    CANCELLED: 'bg-red-100 text-red-700',
};

const StatCard = ({ title, value, icon: Icon, sub }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:shadow-md transition-shadow">
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
            {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
        </div>
        <div className="p-3 bg-primary-light/50 text-primary rounded-xl group-hover:scale-110 transition-transform">
            <Icon size={24} />
        </div>
    </div>
);

const AppointmentCard = ({ apt }) => {
    const doctor = `Dr. ${apt.doc_first} ${apt.doc_last}`;
    const statusLabel = apt.status.charAt(0).toUpperCase() + apt.status.slice(1).toLowerCase();
    const dateStr = new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-primary/30 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(doctor)}&background=random`} alt={doctor} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{doctor}</h4>
                        <p className="text-xs text-gray-500">{apt.specialty}</p>
                    </div>
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabel}
                </span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2 text-gray-600">
                    <CalendarIcon size={14} className="text-primary flex-shrink-0" />
                    <span className="text-xs">{dateStr}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={14} className="text-primary flex-shrink-0" />
                    <span className="text-xs">{apt.time_slot}</span>
                </div>
                {apt.location_room && (
                    <div className="flex items-center gap-2 text-gray-600 col-span-2">
                        <MapPin size={14} className="text-primary flex-shrink-0" />
                        <span className="text-xs truncate">{apt.location_room}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const PatientDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [upcoming, setUpcoming] = useState([]);
    const [past, setPast] = useState([]);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const [upRes, pastRes] = await Promise.all([
                    fetch(`${API}/api/patients/${user.id}/appointments?type=upcoming`),
                    fetch(`${API}/api/patients/${user.id}/appointments?type=past`),
                ]);
                const [upData, pastData] = await Promise.all([upRes.json(), pastRes.json()]);
                setUpcoming(Array.isArray(upData) ? upData : []);
                setPast(Array.isArray(pastData) ? pastData : []);
            } catch (err) {
                console.error('Dashboard error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user?.id]);

    // Real derived stats
    const completedCount = past.filter(a => a.status === 'COMPLETED').length;
    const uniqueDoctors = new Set([...upcoming, ...past].map(a => `${a.doc_first} ${a.doc_last}`)).size;
    const nextApt = upcoming[0];
    const nextAptLabel = nextApt
        ? new Date(nextApt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—';

    const displayed = activeTab === 'upcoming' ? upcoming : past;

    if (isLoading) {
        return <div className="p-10 text-center text-gray-500 font-medium animate-pulse">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.first_name}!</h1>
                    <p className="text-gray-500 mt-1">Here is your appointment summary.</p>
                </div>
                <button
                    onClick={() => navigate('/book')}
                    className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-primary/30"
                >
                    Book Appointment
                </button>
            </div>

            {/* Real stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Upcoming" value={upcoming.length} icon={CalendarIcon} sub="confirmed & scheduled" />
                <StatCard title="Completed Visits" value={completedCount} icon={CheckCircle2} sub="all time" />
                <StatCard title="Doctors Seen" value={uniqueDoctors} icon={User} sub="unique doctors" />
                <StatCard title="Next Visit" value={nextAptLabel} icon={Clock} sub={nextApt ? nextApt.time_slot : 'no upcoming'} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main appointments panel */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'upcoming' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Upcoming ({upcoming.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'past' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            Past Visits ({past.length})
                        </button>
                    </div>

                    {/* Appointment cards */}
                    {displayed.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-4">
                            {displayed.map((apt) => (
                                <AppointmentCard key={apt.id} apt={apt} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                                {activeTab === 'upcoming'
                                    ? <CalendarIcon size={28} className="text-gray-400" />
                                    : <CheckCircle2 size={28} className="text-gray-400" />
                                }
                            </div>
                            <p className="text-gray-500 font-medium">
                                {activeTab === 'upcoming' ? 'No upcoming appointments.' : 'No past visits yet.'}
                            </p>
                            {activeTab === 'upcoming' && (
                                <button onClick={() => navigate('/book')} className="mt-4 text-primary text-sm font-medium hover:underline">
                                    Book your first appointment →
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Medical history sidebar — real past appointments */}
                <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Recent History</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        {past.length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">No visit history yet.</p>
                        ) : (
                            <div className="relative pl-6 border-l-2 border-primary/20 space-y-6">
                                {past.slice(0, 5).map((apt, idx) => (
                                    <div key={apt.id} className="relative">
                                        <span className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 bg-white ${idx === 0 ? 'border-primary' : 'border-gray-300'}`}></span>
                                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
                                            {new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <h4 className="text-sm font-semibold text-gray-900 mt-0.5">
                                            Dr. {apt.doc_first} {apt.doc_last}
                                        </h4>
                                        <p className="text-xs text-gray-500">{apt.specialty}</p>
                                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[apt.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {apt.status.toLowerCase()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {past.length > 0 && (
                            <button
                                onClick={() => setActiveTab('past')}
                                className="w-full mt-6 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                            >
                                View all history <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientDashboard;
