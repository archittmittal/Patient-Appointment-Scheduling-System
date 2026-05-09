import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, Heart, Star, MapPin, Clock, Award, Phone, ShieldCheck, ChevronRight } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import PeakHoursAnalytics from '../components/PeakHoursAnalytics';

const ReviewCard = ({ name, rating, date, comment, avatar }) => (
    <div className="glass-card mb-4 group hover:border-primary/30 transition-all duration-300 p-6 bg-primary-light/5">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-[var(--border-base)] shadow-inner">
                    <img src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=ffffff`} alt={name} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h5 className="text-sm font-black text-[var(--text-base)] uppercase tracking-tight">{name}</h5>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">{date}</p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20">
                <Star size={12} className="fill-primary" strokeWidth={2.5} />
                {rating}
            </div>
        </div>
        <p className="text-sm font-bold text-slate-500 leading-relaxed border-l-4 border-primary/20 pl-4 py-1">
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
        const fetchDoctorData = async () => {
            try {
                const [docData, reviewData] = await Promise.all([
                    apiClient.get(`/api/doctors/${id}`),
                    apiClient.get(`/api/doctors/${id}/reviews`)
                ]);

                if (docData && !docData.error) {
                    setDoctor({
                        ...docData,
                        name: `Dr. ${docData.first_name} ${docData.last_name}`,
                        experience: `${docData.experience_years}+ Years`,
                        patients: "2.5K+",
                    });
                }
                if (reviewData && !reviewData.error) setReviews(reviewData);
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        fetchDoctorData();
    }, [id]);

    if (isLoading || !doctor) return <div className="p-20 text-center text-slate-500 font-bold animate-pulse uppercase tracking-widest">Accessing Clinical Registry...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20 px-4 md:px-0">
            {/* Header / Hero Section */}
            <div className="glass-modal rounded-[3.5rem] p-10 flex flex-col lg:flex-row gap-12 relative overflow-hidden group border-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 translate-x-1/4 -translate-y-1/4 animate-pulse"></div>
                
                <div className="w-56 h-56 lg:w-80 lg:h-80 rounded-[3rem] overflow-hidden flex-shrink-0 bg-slate-900/40 p-1 shadow-2xl group-hover:scale-[1.02] transition-transform duration-700 border border-primary/10">
                    <img src={doctor.image_url || `https://ui-avatars.com/api/?name=${doctor.first_name}+${doctor.last_name}&background=1e293b&color=fff&size=512`} alt={doctor.name} className="w-full h-full object-cover rounded-[2.9rem] opacity-90 transition-opacity" />
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-3">
                            <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm flex items-center gap-2 w-fit">
                                <ShieldCheck size={14} strokeWidth={2.5} /> Clinical Excellence Verified
                            </span>
                            <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase ">{doctor.name}</h1>
                            <p className="text-2xl font-black text-primary uppercase tracking-widest opacity-80">{doctor.specialty}</p>
                            <p className="text-slate-500 font-bold text-sm tracking-wide bg-white/5 w-fit px-3 py-1 rounded-lg border border-[var(--border-base)]">{doctor.degree} • GMC Board Certified</p>
                        </div>
                        <div className="flex gap-3">
                            <button className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95 border-[var(--border-base)]">
                                <Heart size={20} strokeWidth={2.5} />
                            </button>
                            <button className="w-12 h-12 rounded-2xl glass-card flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/10 transition-all active:scale-95 border-[var(--border-base)]">
                                <Share2 size={20} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10">
                        <StatBox label="Registry Core" value={doctor.patients} />
                        <StatBox label="Clinical Tenure" value={doctor.experience} />
                        <StatBox label="Satisfaction" value={doctor.rating} subIcon={<Star size={16} className="fill-amber-500 text-amber-500" />} />
                        <StatBox label="Testimonials" value={doctor.review_count} />
                    </div>

                    <div className="mt-10 flex flex-col sm:flex-row gap-5">
                        <button
                            onClick={() => navigate('/book')}
                            className="btn-primary flex-1 py-5 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-3 group"
                        >
                            Schedule Clinical Visit <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="btn-secondary px-10 py-5 font-black text-xs uppercase tracking-widest border-[var(--border-base)] text-slate-500 hover:text-primary flex items-center justify-center gap-3 active:scale-[0.98]">
                            <Phone size={18} strokeWidth={2.5} /> Quick Connect
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                    <div className="glass-card p-10 hover:border-primary/20 transition-all bg-primary-light/5 border-[var(--border-base)]">
                        <h3 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tight mb-8 flex items-center gap-4">
                            <span className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Award size={20} /></span>
                            Professional Bio-Record
                        </h3>
                        <p className="text-slate-500 font-bold leading-relaxed text-lg border-l-4 border-primary/20 pl-6">
                            {doctor.about}
                        </p>

                        <div className="mt-12">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3 ">
                                <Clock size={16} className="text-primary" /> Operational Window Matrix
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {doctor.availability ? Object.entries(typeof doctor.availability === 'string' ? JSON.parse(doctor.availability) : doctor.availability).map(([day, slot]) => (
                                    <div key={day} className={`group flex items-center justify-between p-5 rounded-3xl border transition-all ${slot.open ? 'bg-white/5 border-[var(--border-base)] hover:border-primary/30' : 'bg-rose-500/5 border-rose-500/10 opacity-60'}`}>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${slot.open ? 'text-slate-500' : 'text-rose-500'}`}>{day}</span>
                                        <span className={`text-xs font-black ${slot.open ? 'text-[var(--text-base)]' : 'text-rose-500/70'}`}>
                                            {slot.open ? `${slot.from} — ${slot.to}` : 'Closed'}
                                        </span>
                                    </div>
                                )) : <div className="p-4 text-slate-500 opacity-50 font-bold">Registry data offline...</div>}
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-10 border-[var(--border-base)]">
                        <div className="flex items-center justify-between mb-10">
                            <h3 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tight flex items-center gap-4">
                                <span className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Heart size={20} /></span>
                                Verified Testimonials
                            </h3>
                            <button onClick={() => navigate('/feedback')} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline px-4 py-2">View Analytics</button>
                        </div>
                        {reviews.length > 0 ? reviews.map(review => <ReviewCard key={review.id} {...review} />) : <div className="p-10 text-center text-slate-500 font-bold opacity-40 uppercase tracking-widest">No patient feedback indexed.</div>}
                    </div>
                </div>

                <div className="space-y-8">
                    <PeakHoursAnalytics doctorId={id} />
                    
                    <div className="glass-card p-10 hover:border-primary/20 transition-all overflow-hidden relative group border-[var(--border-base)]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
                        <h3 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tight mb-8 flex items-center gap-4">
                            <span className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><MapPin size={20} /></span>
                            Deployment
                        </h3>
                        <div className="flex items-start gap-4 mb-10">
                            <div className="flex-1">
                                <h5 className="text-sm font-black text-[var(--text-base)] uppercase tracking-wide leading-none">Global Medical Center</h5>
                                <p className="text-[10px] font-black text-slate-500 mt-2 uppercase tracking-widest">{doctor.location_room || 'Unit Core B-102'}</p>
                            </div>
                        </div>
                        <div className="w-full h-64 bg-slate-900/40 rounded-[2.5rem] overflow-hidden relative group shadow-inner border border-white/5">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1)_0%,transparent_100%)] flex flex-col items-center justify-center text-center p-8 grayscale group-hover:grayscale-0 transition-all duration-1000">
                                <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
                                    <MapPin size={28} className="text-primary animate-bounce-slow" />
                                </div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-1">Clinical Localization</p>
                                <p className="text-[10px] font-bold text-slate-500">Facility Level 4 • South Wing</p>
                            </div>
                        </div>
                        <button className="w-full mt-8 py-5 bg-primary/5 border border-[var(--border-base)] rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Request Deployment Path</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatBox = ({ label, value, subIcon }) => (
    <div className="glass-card bg-white/5 p-6 rounded-[2rem] hover:scale-105 transition-all border-[var(--border-base)] group hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 group-hover:text-primary transition-colors">{label}</p>
        <div className="flex items-center gap-2 mt-1">
            <p className="text-3xl font-black text-[var(--text-base)] tracking-tighter ">{value}</p>
            {subIcon}
        </div>
    </div>
);

export default DoctorProfile;
