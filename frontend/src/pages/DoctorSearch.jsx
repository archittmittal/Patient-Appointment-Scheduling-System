import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Filter, Calendar as CalendarIcon, Users, ArrowRight, Activity, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const getNextAvailableDate = (availability) => {
    if (!availability) return null;
    const av = typeof availability === 'string' ? JSON.parse(availability) : availability;
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        const dayName = DAY_NAMES[d.getDay()];
        const dayAvail = av[dayName];
        const isOpen = dayAvail && (Array.isArray(dayAvail) ? dayAvail.length > 0 : dayAvail.open);
        if (isOpen) {
            if (i === 0) return 'Today';
            if (i === 1) return 'Tomorrow';
            return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    }
    return null;
};

const DoctorCard = ({ id, name, specialty, rating, location_room, image_url, nextAvailable, consultation_fee }) => {
    const navigate = useNavigate();
    return (
        <div className="apple-card p-6 border border-[var(--border-base)]/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 group">
            <div className="flex gap-5">
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-[var(--bg-base)] border border-[var(--border-base)]/30">
                    <img
                        src={image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0071e3&color=ffffff&bold=true`}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-[var(--text-base)] leading-tight truncate group-hover:text-primary transition-colors">
                                {name}
                            </h3>
                            <p className="text-sm text-primary font-medium mt-0.5">{specialty}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-xs font-semibold border border-amber-100 shrink-0">
                            <Star size={12} className="fill-amber-600" />
                            {rating}
                        </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-base)]/60">
                            <MapPin size={14} className="text-[var(--text-base)]/40" />
                            <span className="truncate">{location_room || 'Main Clinic'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-base)]/60">
                            <CalendarIcon size={14} className="text-[var(--text-base)]/40" />
                            {nextAvailable ? (
                                <span>Next available <span className="text-success font-medium">{nextAvailable}</span></span>
                            ) : (
                                <span className="text-danger/70 ">Fully booked this week</span>
                            )}
                        </div>
                        {consultation_fee && (
                            <div className="flex items-center gap-2 text-xs">
                                <IndianRupee size={14} className="text-emerald-500/70" />
                                <span className="text-emerald-600 font-semibold">₹{Number(consultation_fee).toLocaleString('en-IN')}</span>
                                <span className="text-[var(--text-base)]/40">per visit</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 flex gap-3">
                <button
                    onClick={() => navigate(`/doctors/${id}`)}
                    className="flex-1 py-2.5 text-sm font-medium text-[var(--text-base)] hover:bg-[var(--bg-base)] border border-[var(--border-base)] rounded-xl transition-all"
                >
                    View Profile
                </button>
                <button
                    onClick={() => navigate('/book')}
                    className="flex-1 py-2.5 text-sm font-medium bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/10 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    Book Now <ArrowRight size={14} />
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
        const fetchDoctors = async () => {
            setIsLoading(true);
            try {
                const data = await apiClient.get('/api/doctors');
                if (data && Array.isArray(data)) {
                    setDoctors(data.map(doc => ({
                        ...doc,
                        name: `Dr. ${doc.first_name} ${doc.last_name}`,
                        nextAvailable: getNextAvailableDate(doc.availability),
                    })));
                }
            } catch (err) {
                console.error('Failed to fetch doctors:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDoctors();
    }, []);

    const specialties = ['All', ...new Set(doctors.map(d => d.specialty).filter(Boolean))];

    const filtered = doctors.filter(doc => {
        const matchFilter = activeFilter === 'All' || doc.specialty?.trim().toLowerCase() === activeFilter?.trim().toLowerCase();
        const matchSearch = searchQuery === '' ||
            doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.specialty.toLowerCase().includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
    });

    return (
        <div className="section-container animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        <Activity size={14} />
                        <span>Healthcare Professionals</span>
                    </div>
                    <h1 className="text-3xl font-bold text-[var(--text-base)] tracking-tight">Find Your Specialist</h1>
                    <p className="text-[var(--text-base)]/60 max-w-lg">
                        Browse our network of certified doctors and book an appointment in seconds.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[var(--border-base)]/50 shadow-sm text-sm">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                    <span className="font-medium text-[var(--text-base)]/70">{doctors.length} Doctors Available</span>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-6 mb-12">
                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-base)]/40 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name or specialty..."
                        className="w-full pl-14 pr-6 py-4 bg-white border border-[var(--border-base)] rounded-2xl text-base placeholder:text-[var(--text-base)]/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 shadow-sm transition-all"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar">
                    {specialties.map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95 border ${activeFilter === filter
                                ? 'bg-primary text-white border-primary shadow-md shadow-primary/10'
                                : 'bg-white text-[var(--text-base)]/60 border-[var(--border-base)] hover:border-primary/50 hover:text-primary'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-[var(--text-base)]/40 font-medium">Finding specialists...</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.length > 0 ? (
                            filtered.map(doc => <DoctorCard key={doc.id} {...doc} />)
                        ) : (
                            <div className="col-span-full py-20 text-center apple-card bg-transparent border-2 border-dashed border-[var(--border-base)]/50">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[var(--text-base)]/20 mx-auto mb-4 border border-[var(--border-base)]">
                                    <Search size={32} />
                                </div>
                                <h3 className="text-lg font-semibold text-[var(--text-base)] mb-2">No doctors found</h3>
                                <p className="text-[var(--text-base)]/50 mb-6">Try adjusting your search or filters to find a specialist.</p>
                                <button 
                                    onClick={() => {setSearchQuery(''); setActiveFilter('All');}}
                                    className="btn-secondary py-2"
                                >
                                    Clear all filters
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default DoctorSearch;

