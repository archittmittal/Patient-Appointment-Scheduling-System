import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

const TimeSlot = ({ time, isSelected, isAvailable, onClick }) => (
    <button
        onClick={onClick}
        disabled={!isAvailable}
        className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${!isAvailable
                ? 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100'
                : isSelected
                    ? 'bg-primary text-white shadow-md shadow-primary/30 border border-primary'
                    : 'bg-white text-gray-700 hover:border-primary/50 hover:text-primary border border-gray-200 cursor-pointer'
            }`}
    >
        {time}
    </button>
);

const BookAppointment = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState(25);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isBooked, setIsBooked] = useState(false);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dates = Array.from({ length: 31 }, (_, i) => i + 1);

    const morningSlots = [
        { time: '09:00 AM', isAvailable: true },
        { time: '09:30 AM', isAvailable: false },
        { time: '10:00 AM', isAvailable: true },
        { time: '10:30 AM', isAvailable: true },
        { time: '11:00 AM', isAvailable: false },
        { time: '11:30 AM', isAvailable: true },
    ];

    const afternoonSlots = [
        { time: '01:00 PM', isAvailable: true },
        { time: '01:30 PM', isAvailable: true },
        { time: '02:00 PM', isAvailable: false },
        { time: '02:30 PM', isAvailable: true },
        { time: '03:00 PM', isAvailable: true },
        { time: '03:30 PM', isAvailable: false },
    ];

    if (isBooked) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-sm border border-gray-100 min-h-[60vh] animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Appointment Confirmed!</h2>
                <p className="text-gray-500 text-center max-w-md mb-8">
                    Your appointment with Dr. Sarah Jenkins is confirmed for Oct 25, 2026 at {selectedSlot}. You will receive a notification shortly.
                </p>
                <div className="flex gap-4">
                    <button onClick={() => navigate('/queue')} className="px-6 py-3 bg-primary text-white font-medium rounded-xl shadow-sm hover:bg-primary-hover transition-colors">
                        Track Live Queue
                    </button>
                    <button onClick={() => navigate('/patient-dashboard')} className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>
                <p className="text-gray-500 mt-1">Select an available date and time slot to book your visit.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                    <img src="https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random" alt="Doctor" className="w-16 h-16 rounded-xl bg-gray-100 object-cover" />
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Dr. Sarah Jenkins</h3>
                        <p className="text-primary font-medium">Cardiologist</p>
                    </div>
                </div>

                <div className="mt-8 space-y-8 flex flex-col lg:flex-row lg:space-y-0 lg:gap-12">
                    {/* Calendar Section */}
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <CalendarIcon size={20} className="text-primary" />
                                Select Date
                            </h4>
                            <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
                                <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-900 transition-colors"><ChevronLeft size={20} /></button>
                                October 2026
                                <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-900 transition-colors"><ChevronRight size={20} /></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center">
                            {days.map(day => (
                                <div key={day} className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                                    {day}
                                </div>
                            ))}

                            {/* Padding for first day of month (just an example) */}
                            <div className="col-span-4"></div>

                            {dates.map(date => (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-medium transition-colors ${selectedDate === date
                                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    {date}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="hidden lg:block w-px bg-gray-100"></div>

                    {/* Time Slots Section */}
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-6">
                            <Clock size={20} className="text-primary" />
                            Available Time
                        </h4>

                        <div className="space-y-6">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-3">Morning</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {morningSlots.map(slot => (
                                        <TimeSlot
                                            key={slot.time}
                                            {...slot}
                                            isSelected={selectedSlot === slot.time}
                                            onClick={() => setSelectedSlot(slot.time)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-3">Afternoon</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {afternoonSlots.map(slot => (
                                        <TimeSlot
                                            key={slot.time}
                                            {...slot}
                                            isSelected={selectedSlot === slot.time}
                                            onClick={() => setSelectedSlot(slot.time)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-100 flex justify-end">
                    <button
                        disabled={!selectedDate || !selectedSlot}
                        onClick={() => setIsBooked(true)}
                        className={`px-8 py-3.5 rounded-xl font-medium transition-all ${selectedDate && selectedSlot
                                ? 'bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary-hover hover:-translate-y-0.5'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        Confirm Appointment
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookAppointment;
