import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, Heart, Star, MapPin, Clock, Award, Phone } from 'lucide-react';
import { API } from '../config/api';
import PeakHoursAnalytics from '../components/PeakHoursAnalytics'; // Issue #44

const ReviewCard = ({ name, rating, date, comment, avatar }) => (
    <div className="glass-card mb-4 group hover:border-indigo-100 transition-all duration-300 p-6">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[1.25rem] overflow-hidden border-2 border-slate-50 shadow-sm">
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">{name}</h5>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{date}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Star size={12} className="fill-indigo-500 text-indigo-500" strokeWidth={2.5} />
                {rating}
            </div>
        </div>
        <p className="text-sm font-bold text-slate-600 leading-relaxed italic border-l-4 border-indigo-100 pl-4 py-1">
            "{comment}"
        </p>
    </div>
);

const DoctorProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [doctor, setDoctor] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        // Fetch doctor details
        fetch(`${API}/api/doctors/${id}`)
            .then(res => res.json())
            .then(data => {
                setDoctor({
                    ...data,
                    name: `Dr. ${data.first_name} ${data.last_name}`,
                    experience: `${data.experience_years}+ Years`,
                    patients: "2.5K+", // Still mock
                });
            })
            .catch(err => console.error("Error fetching doctor:", err));

        // Fetch doctor reviews
        fetch(`${API}/api/doctors/${id}/reviews`)
            .then(res => res.json())
            .then(data => setReviews(data))
            .catch(err => console.error("Error fetching reviews:", err))
            .finally(() => setIsLoading(false));
    }, [id]);

    if (isLoading || !doctor) {
        return <div className="max-w-5xl mx-auto p-10 text-center font-medium text-gray-500">Loading doctor profile...</div>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        <div className="glass-modal rounded-[3rem] p-10 flex flex-col md:flex-row gap-12 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-[100px] -z-10 translate-x-1/4 -translate-y-1/4 animate-pulse"></div>

            <div className="w-56 h-56 md:w-72 md:h-72 rounded-[2.5rem] overflow-hidden flex-shrink-0 bg-slate-900 p-1 shadow-2xl group-hover:scale-[1.02] transition-transform duration-700">
                <img src={doctor.image_url || `https://ui-avatars.com/api/?name=${doctor.first_name}+${doctor.last_name}&background=0F172A&color=fff&size=512`} alt={doctor.name} className="w-full h-full object-cover rounded-[2.25rem] opacity-90 hover:opacity-100 transition-opacity" />
            </div>

            <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] shadow-sm flex items-center gap-1.5">
                                <Award size={12} strokeWidth={2.5} /> Verified Medical Expert
                            </span>
                        </div>
                        <h1 className="text-5xl font-black text-slate-900 tracking-tighter">{doctor.name}</h1>
                        <p className="text-xl font-black text-indigo-600 uppercase tracking-widest opacity-80">{doctor.specialty}</p>
                        <p className="text-slate-400 font-bold text-sm tracking-wide">{doctor.degree} • General Medical Council Registered</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-95">
                            <Heart size={20} strokeWidth={2.5} />
                        </button>
                        <button className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95">
                            <Share2 size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
                    <div className="glass-card bg-white/40 p-5 rounded-[1.5rem] hover:scale-105 transition-all">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient Core</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{doctor.patients}</p>
                    </div>
                    <div className="glass-card bg-white/40 p-5 rounded-[1.5rem] hover:scale-105 transition-all">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tenure</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{doctor.experience}</p>
                    </div>
                    <div className="glass-card bg-white/40 p-5 rounded-[1.5rem] hover:scale-105 transition-all border-amber-100">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">Rating</p>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-2xl font-black text-slate-900">{doctor.rating}</p>
                            <Star size={16} className="fill-amber-500 text-amber-500" strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="glass-card bg-white/40 p-5 rounded-[1.5rem] hover:scale-105 transition-all">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Reviews</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{doctor.review_count}</p>
                    </div>
                </div>

                <div className="mt-10 flex gap-5">
                    <button
                        onClick={() => navigate('/book')}
                        className="btn-primary flex-1 py-5 font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-500/20 active:scale-[0.98]"
                    >
                        Schedule Clinical Visit
                    </button>
                    <button className="btn-secondary px-8 py-5 font-black text-xs uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-3 active:scale-[0.98]">
                        <Phone size={18} strokeWidth={2.5} className="animate-bounce" />
                        Quick Connect
                    </button>
                </div>
            </div>
        </div>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    <div className="glass-card p-10 hover:border-indigo-100 transition-all">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Award size={18} />
                            </span>
                            Clinical Profile
                        </h3>
                        <p className="text-slate-600 font-bold leading-relaxed text-lg">
                            {doctor.about}
                        </p>

                        <div className="mt-12">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <Clock size={14} strokeWidth={2.5} /> Operational Hours
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {doctor.availability
                                    ? Object.entries(
                                        typeof doctor.availability === 'string'
                                            ? JSON.parse(doctor.availability)
                                            : doctor.availability
                                      ).map(([day, slot]) => (
                                        <div key={day} className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${slot.open ? 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm' : 'bg-rose-50 border-rose-100 opacity-60'}`}>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${slot.open ? 'text-slate-500' : 'text-rose-600'}`}>{day}</span>
                                            <span className={`text-xs font-black ${slot.open ? 'text-slate-900' : 'text-rose-700'}`}>
                                                {slot.open ? `${slot.from} – ${slot.to}` : 'Closed'}
                                            </span>
                                        </div>
                                    ))
                                    : (
                                        <>
                                            <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mon – Fri</span>
                                                <span className="text-xs font-black text-slate-900">09:00 – 17:00</span>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saturday</span>
                                                <span className="text-xs font-black text-slate-900">10:00 – 14:00</span>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-2xl opacity-60">
                                                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Sunday</span>
                                                <span className="text-xs font-black text-rose-700">Closed</span>
                                            </div>
                                        </>
                                    )
                                }
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-10">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Heart size={18} />
                                </span>
                                Patient Testimonials
                            </h3>
                            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">
                                View Full Registry
                            </button>
                        </div>

                        <div>
                            {reviews.map(review => (
                                <ReviewCard
                                    key={review.id}
                                    name={review.name}
                                    rating={review.rating}
                                    date={review.date}
                                    comment={review.comment}
                                    avatar={review.avatar}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Issue #44: Peak Hours Analytics */}
                    <PeakHoursAnalytics doctorId={id} />
                    
                    <div className="glass-card p-8 hover:border-indigo-100 transition-all overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
                        
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <MapPin size={18} />
                            </span>
                            Location
                        </h3>

                        <div className="flex items-start gap-4 mb-8">
                            <div className="flex-1">
                                <h5 className="text-sm font-black text-slate-800 uppercase tracking-wide">City Hospital Complex</h5>
                                <p className="text-xs font-bold text-slate-500 mt-1">{doctor.location_room}</p>
                            </div>
                        </div>

                        <div className="w-full h-56 bg-slate-900 rounded-[2rem] overflow-hidden relative group shadow-2xl">
                            {/* Dummy Map Visual with Medical Calm theme */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e293b_0%,#0f172a_100%)] flex flex-col items-center justify-center text-center p-6 grayscale hover:grayscale-0 transition-all duration-700">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mb-4">
                                    <MapPin size={24} className="text-indigo-400 animate-bounce" />
                                </div>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Interactive Map View</p>
                                <p className="text-[10px] font-bold text-slate-500 mt-2">Hospital Wing B • Level 4 • Room 402</p>
                            </div>
                        </div>

                        <button className="w-full mt-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all">
                            Get Directions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorProfile;
