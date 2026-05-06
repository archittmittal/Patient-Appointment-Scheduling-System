/**
 * Patient Dashboard - REDESIGNED FOR PREMIUM EXPERIENCE
 * Simple, linear, and human-centric.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Calendar as CalendarIcon, Clock, MapPin, CheckCircle2, User, 
    ChevronRight, Bell, X, ListPlus, Activity, Zap, ClipboardCheck, 
    AlarmClock, MessageSquare, ArrowRight, Sparkles, Navigation, Lock, Users,
    Heart, Pill, FileText, Droplets, Thermometer
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';
import { safeFetch } from '../utils/apiHelper';

const STATUS_STYLES = {
    CONFIRMED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    PENDING:   'bg-amber-50 text-amber-600 border-amber-100',
    COMPLETED: 'bg-slate-50 text-slate-600 border-slate-100',
    CANCELLED: 'bg-rose-50 text-rose-600 border-rose-100',
    LATE_ARRIVAL: 'bg-orange-50 text-orange-600 border-orange-100',
    NEEDS_RESCHEDULE: 'bg-purple-50 text-purple-600 border-purple-100'
};

const QuickAction = ({ icon: Icon, title, onClick, color = 'primary' }) => (
    <button 
        onClick={onClick}
        className="flex flex-col items-center gap-3 group transition-all"
    >
        <div className={`w-16 h-16 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:-translate-y-1 transition-all duration-300`}>
            <Icon size={24} className="text-primary group-hover:scale-110 transition-transform" strokeWidth={1.5} />
        </div>
        <span className="text-[13px] font-semibold text-slate-600 tracking-tight">{title}</span>
    </button>
);

const AppointmentCard = ({ apt, navigate, onViewReport }) => {
    if (!apt) return null;
    const doctor = `Dr. ${apt.doc_first || 'Unknown'} ${apt.doc_last || ''}`;
    const statusLabel = String(apt.status || 'PENDING').toUpperCase();
    const dateStr = apt.appointment_date ? new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Date TBD';
    
    return (
        <div className="apple-card p-6 flex flex-col gap-6 group hover:shadow-xl transition-all duration-500">
            <div className="flex justify-between items-start">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(doctor)}&background=f1f5f9&color=64748b&size=100`} alt={doctor} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 leading-tight">{doctor}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{apt.specialty || 'General Practitioner'}</p>
                    </div>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${STATUS_STYLES[statusLabel] || 'bg-slate-50 text-slate-500'}`}>
                    {statusLabel.replace('_', ' ')}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                <div className="flex items-center gap-3">
                    <CalendarIcon size={16} className="text-slate-400" strokeWidth={1.5} />
                    <span className="text-[13px] font-medium text-slate-700">{dateStr}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Clock size={16} className="text-slate-400" strokeWidth={1.5} />
                    <span className="text-[13px] font-medium text-slate-700">{apt.time_slot || '--:--'}</span>
                </div>
            </div>

            <button 
                onClick={() => navigate(`/virtual-waiting/${apt.id}`)}
                className="w-full py-3.5 bg-primary text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
            >
                View Details <ChevronRight size={16} />
            </button>
        </div>
    );
};

const PatientDashboard = () => {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ upcoming: [], past: [], waitlist: [], offers: [], feedback: [], express: [], prep: [], vitals: [], prescriptions: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReportApt, setSelectedReportApt] = useState(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const headers = authedHeaders();
                const endpoints = [
                    { key: 'upcoming', url: `${API}/api/patients/${user.id}/appointments?type=upcoming` },
                    { key: 'past', url: `${API}/api/patients/${user.id}/appointments?type=past` },
                    { key: 'feedback', url: `${API}/api/feedback/pending` },
                    { key: 'vitals', url: `${API}/api/patients/${user.id}/vitals` },
                    { key: 'prescriptions', url: `${API}/api/patients/${user.id}/prescriptions` }
                ];

                const results = await Promise.all(endpoints.map(ep => safeFetch(ep.url, { headers })));
                const newStats = {};
                endpoints.forEach((ep, i) => {
                    newStats[ep.key] = Array.isArray(results[i]) ? results[i] : (results[i]?.data || []);
                });
                setStats(prev => ({ ...prev, ...newStats }));
            } catch (err) { 
                console.error('Failed to sync health data:', err); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchData();
    }, [user?.id, authLoading]);

    if (authLoading || (isLoading && user)) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-10 animate-pulse">
                <div className="w-16 h-16 bg-slate-200 rounded-3xl animate-spin mb-6"></div>
                <h2 className="text-xl font-bold text-slate-400">Loading your health hub...</h2>
            </div>
        );
    }

    const nextApt = stats.upcoming?.[0];
    const latestVitals = stats.vitals && stats.vitals.length > 0 ? stats.vitals[stats.vitals.length - 1] : null;
    const recentPrescriptions = stats.prescriptions && stats.prescriptions.length > 0 ? stats.prescriptions.slice(0, 2) : [];

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000">
            {/* Simple Welcome */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Hello, {user?.first_name || 'there'}.</h1>
                    <p className="text-lg text-slate-500 mt-2 font-medium">Here's an update on your health journey.</p>
                </div>
                <button 
                    onClick={() => navigate('/book')}
                    className="group px-8 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center gap-3"
                >
                    <CalendarIcon size={20} strokeWidth={2.5} />
                    New Appointment
                </button>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* Left Column: Health Overview */}
                <div className="lg:col-span-8 space-y-10">
                    
                    {/* Next Appointment Hero */}
                    <div className="px-4">
                        <div className="flex items-center gap-2 mb-6 ml-1">
                            <Sparkles size={16} className="text-primary" />
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Up Next</h2>
                        </div>
                        {nextApt ? (
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 flex flex-col md:flex-row gap-8 items-center group transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10">
                                <div className="w-24 h-24 rounded-3xl bg-primary/5 flex flex-col items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                                    <span className="text-[10px] font-black uppercase tracking-widest">{new Date(nextApt.appointment_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                    <span className="text-4xl font-black">{new Date(nextApt.appointment_date).getDate()}</span>
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{nextApt.specialty || 'Check-up'}</p>
                                    <h3 className="text-2xl font-bold text-slate-900">Dr. {nextApt.doc_first} {nextApt.doc_last}</h3>
                                    <div className="flex items-center justify-center md:justify-start gap-4 mt-3 text-slate-500">
                                        <div className="flex items-center gap-1.5"><Clock size={16} /> <span className="text-sm font-semibold">{nextApt.time_slot}</span></div>
                                        <div className="flex items-center gap-1.5"><MapPin size={16} /> <span className="text-sm font-semibold">Medical Center</span></div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => navigate(`/virtual-waiting/${nextApt.id}`)}
                                    className="w-full md:w-auto px-10 py-5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
                                >
                                    Check In
                                </button>
                            </div>
                        ) : (
                            <div className="apple-card p-12 text-center border-dashed border-2">
                                <CalendarIcon size={48} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-500 font-semibold italic">No upcoming appointments scheduled.</p>
                                <button onClick={() => navigate('/book')} className="mt-4 text-primary font-bold hover:underline">Book one now</button>
                            </div>
                        )}
                    </div>

                    {/* Current Medications Widget */}
                    <div className="px-4">
                        <div className="flex items-center justify-between mb-6 ml-1">
                            <div className="flex items-center gap-2">
                                <Pill size={16} className="text-indigo-500" />
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Active Medications</h2>
                            </div>
                            <button onClick={() => navigate('/prescriptions')} className="text-xs font-bold text-primary hover:underline">View History</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {recentPrescriptions.length > 0 ? (
                                recentPrescriptions.map(p => (
                                    <div key={p.id} className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50 flex items-center gap-4 group hover:bg-indigo-50 transition-all">
                                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-110 transition-transform">
                                            <Pill size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-900 leading-tight truncate">{p.medications.split('\n')[0]}</h4>
                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Dr. {p.doctor_first_name} • {new Date(p.date_prescribed).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
                                    <p className="text-sm text-slate-400 italic">No active prescriptions on file.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="px-4">
                        <div className="flex items-center gap-2 mb-6 ml-1">
                            <Zap size={16} className="text-amber-500" />
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Quick Actions</h2>
                        </div>
                        <div className="flex flex-wrap gap-8 md:gap-12">
                            <QuickAction icon={Droplets} title="Vitals Hub" onClick={() => navigate('/vitals')} />
                            <QuickAction icon={Pill} title="Medications" onClick={() => navigate('/prescriptions')} />
                            <QuickAction icon={FileText} title="Lab Reports" onClick={() => navigate('/profile')} />
                            <QuickAction icon={MessageSquare} title="Feedback" onClick={() => navigate('/feedback')} />
                            <QuickAction icon={Users} title="Find Doctors" onClick={() => navigate('/doctors')} />
                        </div>
                    </div>

                    {/* Latest Appointments List */}
                    <div className="px-4">
                        <div className="flex items-center justify-between mb-6 ml-1">
                            <div className="flex items-center gap-2">
                                <Activity size={16} className="text-emerald-500" />
                                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Recent Activity</h2>
                            </div>
                            <button onClick={() => navigate('/queue')} className="text-xs font-bold text-primary hover:underline">View All</button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                            {stats.upcoming.slice(1, 3).map(apt => (
                                <AppointmentCard key={apt.id} apt={apt} navigate={navigate} />
                            ))}
                            {stats.upcoming.length <= 1 && stats.past.slice(0, 1).map(apt => (
                                <AppointmentCard key={apt.id} apt={apt} navigate={navigate} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Health Stats & Secondary Info */}
                <div className="lg:col-span-4 space-y-10">
                    
                    {/* Vitals Summary Card */}
                    <div className="apple-card p-8 bg-white border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-5"><Heart size={80} /></div>
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">Latest Vitals</h2>
                        {latestVitals ? (
                            <div className="space-y-8 relative z-10">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-3xl font-bold text-slate-900 leading-none">{latestVitals.blood_pressure_sys}/{latestVitals.blood_pressure_dia}</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Blood Pressure</p>
                                    </div>
                                    <div className="w-12 h-1 bg-primary/10 rounded-full"></div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-3xl font-bold text-slate-900 leading-none">{latestVitals.heart_rate || '--'}<span className="text-base font-medium text-slate-400 ml-1">bpm</span></p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Heart Rate</p>
                                    </div>
                                    <Activity className="text-rose-400" size={24} />
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-3xl font-bold text-slate-900 leading-none">{latestVitals.temperature_c || '--'}<span className="text-base font-medium text-slate-400 ml-1">°C</span></p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Temperature</p>
                                    </div>
                                    <Thermometer className="text-amber-400" size={24} />
                                </div>
                                <button onClick={() => navigate('/vitals')} className="w-full mt-4 py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all text-[13px] flex items-center justify-center gap-2">
                                    View Trends <ArrowRight size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="py-8 text-center">
                                <Activity size={32} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-sm text-slate-500 italic">No vitals data recorded yet.</p>
                            </div>
                        )}
                    </div>

                    {/* Helpful Tips or Notifications */}
                    <div className="apple-card p-8 bg-primary/5 border-primary/10 shadow-none">
                        <div className="flex items-center gap-3 mb-4">
                            <Sparkles size={18} className="text-primary" />
                            <h3 className="font-bold text-primary">Health Tip</h3>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            Staying hydrated is essential for maintaining optimal blood pressure levels. Aim for 8 glasses of water today.
                        </p>
                    </div>

                    {/* Previous Appointments Sidebar */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 ml-1">
                            <CheckCircle2 size={16} className="text-slate-400" />
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">History</h2>
                        </div>
                        <div className="space-y-4">
                            {stats.past.slice(0, 3).map(apt => (
                                <div key={apt.id} className="flex items-center gap-4 p-4 hover:bg-white rounded-2xl transition-all cursor-pointer group">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                                        <FileText size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-900">Dr. {apt.doc_first} {apt.doc_last}</p>
                                        <p className="text-[11px] text-slate-500 font-medium">{new Date(apt.appointment_date).toLocaleDateString()}</p>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-primary transition-all" />
                                </div>
                            ))}
                            {stats.past.length === 0 && (
                                <p className="text-xs text-slate-400 italic ml-1">No previous visits.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientDashboard;
