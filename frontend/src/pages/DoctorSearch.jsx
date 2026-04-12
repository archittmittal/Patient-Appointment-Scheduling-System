import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Filter, Calendar as CalendarIcon, Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API } from '../config/api';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Returns "Today", "Tomorrow", "Mon, Mar 3", or null if unavailable for 7 days
const getNextAvailableDate = (availability) => {
    if (!availability) return null;
    const av = typeof availability === 'string' ? JSON.parse(availability) : availability;
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        const dayName = DAY_NAMES[d.getDay()];
        if (av[dayName]?.open) {
            if (i === 0) return 'Today';
            if (i === 1) return 'Tomorrow';
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    }
    return null;
};

const DoctorCard = ({ id, name, specialty, rating, location_room, image_url, nextAvailable }) => {
    const navigate = useNavigate();
    return (
        <div className="glass-card p-6 border-[var(--border-base)] hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-12 translate-x-12 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex gap-6 relative z-10">
                <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-primary/5 border border-[var(--border-base)] shadow-inner relative group/img">
                    <img
                        src={image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=ffffff&bold=true`}
                        alt={name}
                        className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-primary/0 group-hover/img:bg-primary/10 transition-colors"></div>
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-black text-[var(--text-base)] leading-tight tracking-tight group-hover:text-primary transition-colors uppercase">{name}</h3>
                            <p className="text-primary font-black text-[10px] uppercase tracking-widest mt-1 italic">{specialty}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2.5 py-1.5 rounded-xl text-xs font-black shadow-sm border border-amber-500/20">
                            <Star size={12} className="fill-amber-500" />
                            {rating}
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                            <MapPin size={14} className="text-primary" />
                            {location_room || 'Clinic Suite Undefined'}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">
                            <CalendarIcon size={14} className="text-emerald-500" />
                            {nextAvailable
                                ? <span className="flex items-center gap-1.5">NEXT SLOT: <span className="text-emerald-500 font-black">{nextAvailable}</span></span>
                                : <span className="text-rose-500 italic">No Availability</span>
                            }
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex gap-3 relative z-10">
                <button
                    onClick={() => navigate(`/doctors/${id}`)}
                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary bg-white/5 hover:bg-white/10 border border-[var(--border-base)] rounded-2xl transition-all"
                >
                    Clinical File
                </button>
                <button
                    onClick={() => navigate('/book')}
                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                >
                    Reserve <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};

const DoctorSearch = () => {
    const [activeFilter, setActiveFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [doctors, setDoctors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        fetch(`${API}/api/doctors`)
            .then(res => res.json())
            .then(data => {
                setDoctors(data.map(doc => ({
                    ...doc,
                    name: `Dr. ${doc.first_name} ${doc.last_name}`,
                    nextAvailable: getNextAvailableDate(doc.availability),
                })));
            })
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, []);

    const specialties = ['All', ...new Set(doctors.map(d => d.specialty).filter(Boolean))];

    const filtered = doctors.filter(doc => {
        const matchFilter = activeFilter === 'All' || doc.specialty === activeFilter;
        const matchSearch = searchQuery === '' ||
            doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.specialty.toLowerCase().includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
    });

    return (
        <div className="space-y-10 pb-10 animate-in fade-in duration-700">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary shadow-inner">
                        <Users size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tight uppercase">Medical Registry</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 italic">Discover elite healthcare professionals</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 dark:bg-white/5 px-6 py-2.5 rounded-full border border-[var(--border-base)] shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{doctors.length} Active Specialists</span>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                <div className="relative flex-1 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} strokeWidth={2.5} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name, specialist code, or expertise..."
                        className="w-full pl-16 pr-6 py-6 bg-white/5 border border-[var(--border-base)] rounded-[2.5rem] text-sm font-black uppercase tracking-widest placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 shadow-sm transition-all"
                    />
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar lg:max-w-md">
                    {specialties.map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all active:scale-95 border ${activeFilter === filter
                                ? 'bg-primary text-white shadow-xl shadow-primary/20 border-primary'
                                : 'bg-white/5 text-slate-500 border-[var(--border-base)] hover:border-primary/50 hover:text-primary'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Matrix Results */}
            {isLoading ? (
                <div className="py-20 text-center text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em]">Synchronizing Specialist Data...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filtered.length > 0 ? (
                        filtered.map(doc => <DoctorCard key={doc.id} {...doc} />)
                    ) : (
                        <div className="col-span-full py-24 text-center glass-card border-dashed border-slate-300/30">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4 border border-[var(--border-base)]">
                                <Search size={32} />
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">No medical professionals match your registry query.</p>
                            <button 
                                onClick={() => {setSearchQuery(''); setActiveFilter('All');}}
                                className="px-8 py-3 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                            >
                                Reset Filters
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DoctorSearch;
