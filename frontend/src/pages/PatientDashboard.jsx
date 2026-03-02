import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Activity, FileText, ChevronRight } from 'lucide-react';

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

const AppointmentCard = ({ date, time, doctor, specialty, location, status }) => (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-primary/30 transition-colors cursor-pointer group">
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
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${status === 'Confirmed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
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
    </div>
);

const PatientDashboard = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Welcome back, John! 👋</h1>
                    <p className="text-gray-500 mt-1">Here is your health summary for today.</p>
                </div>
                <button className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-primary/30">
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
                        <AppointmentCard
                            doctor="Dr. Sarah Jenkins"
                            specialty="Cardiologist"
                            date="Oct 24, 2026"
                            time="10:00 AM"
                            location="City Hospital, Room 302"
                            status="Confirmed"
                        />
                        <AppointmentCard
                            doctor="Dr. Michael Chen"
                            specialty="General Physician"
                            date="Nov 02, 2026"
                            time="02:30 PM"
                            location="Central Clinic"
                            status="Pending"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-lg font-bold text-gray-900">Recent Medical History</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-light/50 rounded-bl-full -z-10 blur-xl"></div>

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
                                <p className="text-sm text-gray-600 mt-1">Lab Results showing normal hemoglobin levels.</p>
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
