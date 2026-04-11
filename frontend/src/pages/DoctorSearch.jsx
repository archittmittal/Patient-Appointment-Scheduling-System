import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Filter, Calendar as CalendarIcon } from 'lucide-react';
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
        <div className="glass-card p-6 border-slate-100 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full blur-3xl -translate-y-12 translate-x-12 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="flex gap-5 relative z-10">
                <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-50 border border-slate-100 shadow-sm relative group/img">
                    <img
                        src={image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f8fafc&color=4f46e5&bold=true`}
                        alt={name}
                        className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-indigo-600/0 group-hover/img:bg-indigo-600/5 transition-colors"></div>
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{name}</h3>
                            <p className="text-indigo-500 font-black text-[10px] uppercase tracking-[0.2em] mt-1">{specialty}</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm border border-amber-100">
                            <Star size={14} className="fill-amber-500 text-amber-500" />
                            {rating}
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-widest">
                            <MapPin size={16} className="text-indigo-400" />
                            {location_room || 'Clinic Suite Undefined'}
                        </div>
                        <div className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-widest">
                            <CalendarIcon size={16} className="text-emerald-400" />
                            {nextAvailable
                                ? <span className="flex items-center gap-1.5">NEXT SLOT: <span className="text-emerald-600 font-black">{nextAvailable}</span></span>
                                : <span className="text-rose-400 italic">No Availability</span>
                            }
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex gap-3 relative z-10">
                <button
                    onClick={() => navigate(`/doctors/${id}`)}
                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all active:scale-95"
                >
                    View Record
                </button>
                <button
                    onClick={() => navigate('/book')}
                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-2xl transition-all active:scale-95 border border-indigo-500"
                >
                    Reserve Now
                </button>
            </div>
        </div>
    );
};

const DoctorSearch = () => {
    const [activeFilter, setActiveFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [doctors, setDoctors] = useState([]);

    useEffect(() => {
        fetch(`${API}/api/doctors`)
            .then(res => res.json())
            .then(data => {
                setDoctors(data.map(doc => ({
                    ...doc,
                    name: `Dr. ${doc.first_name} ${doc.last_name}`,
                    nextAvailable: getNextAvailableDate(doc.availability),
                })));
            })
            .catch(err => console.error(err));
    }, []);

    // Build filter list dynamically from loaded doctors; "All" always first
    const specialties = ['All', ...new Set(doctors.map(d => d.specialty).filter(Boolean))];

    const filtered = doctors.filter(doc => {
        const matchFilter = activeFilter === 'All' || doc.specialty === activeFilter;
        const matchSearch = searchQuery === '' ||
            doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.specialty.toLowerCase().includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
    });

    return (
        <div className="space-y-10 pb-10">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                    <Search size={28} strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Medical Registry</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Discover elite healthcare professionals and specialist care.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-stretch">
                <div className="relative flex-1 group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} strokeWidth={2.5} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name, specialist code, or expertise..."
                        className="w-full pl-16 pr-6 py-5 bg-white border border-slate-100 rounded-[2rem] text-sm font-black uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 shadow-sm transition-all"
                    />
                </div>
                <button className="px-8 bg-white border border-slate-100 rounded-[2rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center justify-center group active:scale-95">
                    <Filter size={20} strokeWidth={2.5} className="group-hover:rotate-180 transition-transform duration-500" />
                    <span className="ml-3 text-[10px] font-black uppercase tracking-widest">Advanced Filters</span>
                </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {specialties.map(filter => (
                    <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all active:scale-95 ${activeFilter === filter
                            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 border border-indigo-500'
                            : 'bg-white text-slate-400 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600 shadow-sm'
                            }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.length > 0 ? (
                    filtered.map(doc => <DoctorCard key={doc.id} {...doc} />)
                ) : (
                    <div className="col-span-full py-24 text-center glass-card border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100">
                            <Users size={32} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No medical professionals match your current query.</p>
                        <button 
                            onClick={() => {setSearchQuery(''); setActiveFilter('All');}}
                            className="mt-6 px-6 py-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-50 rounded-full transition-colors"
                        >
                            Reset Registry Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DoctorSearch;
