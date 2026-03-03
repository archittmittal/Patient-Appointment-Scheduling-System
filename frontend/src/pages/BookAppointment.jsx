import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, CheckCircle2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const parseAvailability = (av) => {
    if (!av) return null;
    return typeof av === 'string' ? JSON.parse(av) : av;
};

// "2025-03-10" → "monday"
const getDayOfWeek = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return DAY_NAMES[new Date(y, m - 1, d).getDay()];
};

// Generates hourly range slots e.g. "09:00"→"17:00" gives
// [{ label: "09:00 – 10:00", hour: 9 }, { label: "10:00 – 11:00", hour: 10 }, ...]
const generateHourlySlots = (from, to) => {
    const [fh] = from.split(':').map(Number);
    const [th] = to.split(':').map(Number);
    const slots = [];
    for (let h = fh; h < th; h++) {
        slots.push({
            label: `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`,
            hour: h,
        });
    }
    return slots;
};

const TimeSlot = ({ slot, isSelected, isFull, booked, capacity, onClick }) => (
    <button
        onClick={isFull ? undefined : onClick}
        disabled={isFull}
        className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all border flex flex-col items-center gap-0.5 ${
            isFull
                ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100'
                : isSelected
                    ? 'bg-primary text-white shadow-md shadow-primary/30 border-primary'
                    : 'bg-white text-gray-700 hover:border-primary/50 hover:text-primary border-gray-200 cursor-pointer'
        }`}
    >
        <span>{slot.label}</span>
        <span className={`text-[10px] font-normal ${isFull ? 'text-red-400' : isSelected ? 'text-white/80' : 'text-gray-400'}`}>
            {isFull ? 'Full' : `${booked}/${capacity}`}
        </span>
    </button>
);

const BookAppointment = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [slotCounts, setSlotCounts] = useState({});
    const [symptoms, setSymptoms] = useState('');
    const [isBooked, setIsBooked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        fetch('http://localhost:5001/api/doctors')
            .then(res => res.json())
            .then(data => {
                setDoctors(data);
                if (data.length > 0) setSelectedDoctor(data[0].id);
            })
            .catch(err => console.error(err));
    }, []);

    // Reset when doctor changes
    useEffect(() => { setSelectedSlot(null); setSlotCounts({}); }, [selectedDoctor]);

    // Fetch current booking counts whenever doctor + date are both set
    useEffect(() => {
        if (!selectedDoctor || !selectedDate) return;
        setSelectedSlot(null);
        fetch(`http://localhost:5001/api/doctors/${selectedDoctor}/slot-counts?date=${selectedDate}`)
            .then(res => res.json())
            .then(data => setSlotCounts(data))
            .catch(() => setSlotCounts({}));
    }, [selectedDoctor, selectedDate]);

    const year  = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth     = new Date(year, month + 1, 0).getDate();
    const days  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    const selectedDoctorObj = doctors.find(d => String(d.id) === String(selectedDoctor));
    const doctorAvail       = parseAvailability(selectedDoctorObj?.availability);
    const capacity          = selectedDoctorObj?.max_patients_per_slot || 15;

    const isDocClosed = (dateStr) => {
        if (!doctorAvail) return false;
        return !doctorAvail[getDayOfWeek(dateStr)]?.open;
    };

    const currentDayAvail = selectedDate && doctorAvail ? doctorAvail[getDayOfWeek(selectedDate)] : null;
    const allSlots        = currentDayAvail?.open ? generateHourlySlots(currentDayAvail.from, currentDayAvail.to) : [];
    const morningSlots    = allSlots.filter(s => s.hour < 12);
    const afternoonSlots  = allSlots.filter(s => s.hour >= 12);

    if (isBooked) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-sm border border-gray-100 min-h-[60vh]">
                <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Appointment Confirmed!</h2>
                <p className="text-gray-500 text-center max-w-md mb-8">
                    Your appointment with Dr. {selectedDoctorObj?.first_name} {selectedDoctorObj?.last_name} is confirmed for {selectedDate} at {selectedSlot}.
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

    const SlotGroup = ({ label, slots }) => {
        if (slots.length === 0) return null;
        return (
            <div>
                <p className="text-sm font-medium text-gray-500 mb-3">{label}</p>
                <div className="grid grid-cols-3 gap-3">
                    {slots.map(s => {
                        const booked = slotCounts[s.label] || 0;
                        const isFull = booked >= capacity;
                        return (
                            <TimeSlot
                                key={s.label}
                                slot={s}
                                isSelected={selectedSlot === s.label}
                                isFull={isFull}
                                booked={booked}
                                capacity={capacity}
                                onClick={() => setSelectedSlot(s.label)}
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>
                <p className="text-gray-500 mt-1">Select a doctor, date, and time slot to book your visit.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                {/* Doctor selector */}
                <div className="pb-6 border-b border-gray-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Choose Doctor</label>
                    <select
                        value={selectedDoctor}
                        onChange={e => setSelectedDoctor(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                        {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>
                                Dr. {doc.first_name} {doc.last_name} — {doc.specialty}
                            </option>
                        ))}
                    </select>
                    {selectedDoctorObj && (
                        <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3">
                                <img
                                    src={selectedDoctorObj.image_url || `https://ui-avatars.com/api/?name=${selectedDoctorObj.first_name}+${selectedDoctorObj.last_name}&background=random`}
                                    alt="Doctor"
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Dr. {selectedDoctorObj.first_name} {selectedDoctorObj.last_name}</p>
                                    <p className="text-xs text-primary">{selectedDoctorObj.specialty} · {selectedDoctorObj.location_room}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
                                <Users size={13} />
                                <span>{capacity} patients per slot</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex flex-col lg:flex-row lg:gap-12">
                    {/* Calendar */}
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <CalendarIcon size={20} className="text-primary" />
                                Select Date
                            </h4>
                            <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
                                <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1 hover:bg-gray-100 rounded">
                                    <ChevronLeft size={20} />
                                </button>
                                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1 hover:bg-gray-100 rounded">
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-y-4 gap-x-2 text-center">
                            {days.map(day => (
                                <div key={day} className="text-xs font-medium text-gray-400 uppercase tracking-wide">{day}</div>
                            ))}
                            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(date => {
                                const d       = new Date(year, month, date);
                                const isPast  = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                                const closed  = !isPast && isDocClosed(dateStr);
                                const disabled = isPast || closed;
                                return (
                                    <button
                                        key={date}
                                        disabled={disabled}
                                        onClick={() => setSelectedDate(dateStr)}
                                        title={closed ? 'Doctor unavailable' : undefined}
                                        className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-medium transition-colors
                                            ${selectedDate === dateStr
                                                ? 'bg-primary text-white shadow-md shadow-primary/30'
                                                : disabled
                                                    ? 'text-gray-300 cursor-not-allowed'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        {date}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="hidden lg:block w-px bg-gray-100"></div>

                    {/* Time Slots */}
                    <div className="flex-1 mt-8 lg:mt-0">
                        <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2 mb-6">
                            <Clock size={20} className="text-primary" />
                            Available Time
                        </h4>

                        {!selectedDate ? (
                            <p className="text-sm text-gray-400 italic">Select a date to see available time slots.</p>
                        ) : currentDayAvail && !currentDayAvail.open ? (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium capitalize">
                                Doctor is not available on {getDayOfWeek(selectedDate)}s.
                            </div>
                        ) : allSlots.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No availability configured for this doctor.</p>
                        ) : (
                            <div className="space-y-6">
                                <SlotGroup label="Morning" slots={morningSlots} />
                                <SlotGroup label="Afternoon" slots={afternoonSlots} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Symptoms field */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Symptoms / Reason for Visit <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea
                        value={symptoms}
                        onChange={e => setSymptoms(e.target.value)}
                        rows={3}
                        placeholder="Describe your symptoms or reason for this visit so the doctor can be prepared..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        disabled={!selectedDate || !selectedSlot || !selectedDoctor || isSubmitting}
                        onClick={async () => {
                            setIsSubmitting(true);
                            try {
                                await fetch('http://localhost:5001/api/appointments/book', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        patientId: user.id,
                                        doctorId: selectedDoctor,
                                        date: selectedDate,
                                        timeSlot: selectedSlot,
                                        symptoms: symptoms || null,
                                    })
                                });
                                setIsBooked(true);
                            } catch (err) {
                                console.error('Failed to book:', err);
                                alert('Failed to book appointment');
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        className={`px-8 py-3.5 rounded-xl font-medium transition-all ${selectedDate && selectedSlot && selectedDoctor && !isSubmitting
                            ? 'bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary-hover hover:-translate-y-0.5'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? 'Booking...' : 'Confirm Appointment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookAppointment;
