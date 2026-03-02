import React from 'react';
import { Clock, Users, Activity, CheckCircle2, AlertCircle } from 'lucide-react';

const QueueItem = ({ number, name, status, time, isCurrent }) => (
    <div className={`flex items-center p-4 rounded-xl border transition-all ${isCurrent
            ? 'bg-primary-light/30 border-primary shadow-sm scale-[1.02]'
            : status === 'Completed'
                ? 'bg-gray-50 border-gray-100 opacity-75'
                : 'bg-white border-gray-100 hover:border-gray-300'
        }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${isCurrent ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-gray-100 text-gray-500'
            }`}>
            {number}
        </div>
        <div className="ml-4 flex-1">
            <h4 className={`font-semibold ${isCurrent ? 'text-primary' : 'text-gray-900'}`}>{name}</h4>
            <p className="text-sm text-gray-500">{status}</p>
        </div>
        <div className="text-right">
            <p className="font-medium text-gray-900">{time}</p>
            {status === 'Completed' && <CheckCircle2 size={16} className="text-green-500 inline-block mt-1" />}
            {isCurrent && <Activity size={16} className="text-primary inline-block mt-1 animate-pulse" />}
        </div>
    </div>
);

const LiveQueue = () => {
    const currentToken = 14;
    const yourToken = 18;
    const estimatedWaitTime = 45; // minutes

    const queueData = [
        { number: 12, name: "Maria Garcia", status: "Completed", time: "10:15 AM", isCurrent: false },
        { number: 13, name: "James Smith", status: "Completed", time: "10:30 AM", isCurrent: false },
        { number: 14, name: "Emma Johnson", status: "In Progress", time: "10:45 AM", isCurrent: true },
        { number: 15, name: "Robert Davis", status: "Waiting", time: "11:00 AM", isCurrent: false },
        { number: 16, name: "William Miller", status: "Waiting", time: "11:15 AM", isCurrent: false },
        { number: 17, name: "Sophia Wilson", status: "Waiting", time: "11:30 AM", isCurrent: false },
        { number: 18, name: "John Doe (You)", status: "Waiting", time: "11:45 AM", isCurrent: false },
        { number: 19, name: "Oliver Taylor", status: "Waiting", time: "12:00 PM", isCurrent: false },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    Live Queue Tracking
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                </h1>
                <p className="text-gray-500 mt-1">Real-time updates for Dr. Sarah Jenkins' clinic.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-primary to-primary-hover rounded-3xl p-8 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-primary-light font-medium mb-1">Current Token</p>
                                <h2 className="text-6xl font-bold">{currentToken}</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-primary-light font-medium mb-1">Your Token</p>
                                <h2 className="text-4xl font-bold text-white/90">{yourToken}</h2>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/20 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-white/70 text-sm mb-1">Estimated Wait Time</p>
                                <p className="text-xl font-semibold flex items-center gap-2">
                                    <Clock size={20} /> ~{estimatedWaitTime} mins
                                </p>
                            </div>
                            <div>
                                <p className="text-white/70 text-sm mb-1">People Ahead of You</p>
                                <p className="text-xl font-semibold flex items-center gap-2">
                                    <Users size={20} /> {yourToken - currentToken - 1} People
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Users className="text-primary" />
                                Queue Sequence
                            </h3>
                            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {queueData.length} Total Patients
                            </span>
                        </div>

                        <div className="space-y-3">
                            {queueData.map(item => (
                                <QueueItem key={item.number} {...item} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100">
                        <div className="flex items-start gap-4">
                            <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-orange-900 mb-2">Important Instructions</h4>
                                <ul className="space-y-3 text-sm text-orange-800 list-disc list-inside">
                                    <li>Please arrive at the clinic at least 15 minutes before your estimated time.</li>
                                    <li>If you miss your turn, you will be shifted down the queue by 3 places.</li>
                                    <li>Keep your ID and previous medical records handy.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-gray-100 mb-4 overflow-hidden border-2 border-primary">
                            <img src="https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random" alt="Doctor" className="w-full h-full object-cover" />
                        </div>
                        <h4 className="font-bold text-gray-900">Dr. Sarah Jenkins</h4>
                        <p className="text-sm text-gray-500 mb-6">Cardiologist • Room 302</p>

                        <button className="w-full py-3 bg-gray-50 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors border border-gray-100 hover:border-red-200">
                            Cancel Appointment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveQueue;
