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
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    <img
                        src={image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">{name}</h3>
                            <p className="text-primary font-medium text-sm">{specialty}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2.5 py-1 rounded-lg text-sm font-medium">
                            <Star size={16} className="fill-yellow-500 text-yellow-500" />
                            {rating}
                        </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <MapPin size={16} />
                            {location_room || 'Location not set'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <CalendarIcon size={16} />
                            {nextAvailable
                                ? <>Next slot: <span className="font-medium text-gray-900">{nextAvailable}</span></>
                                : <span className="text-gray-400 italic">No availability this week</span>
                            }
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex gap-3">
                <button
                    onClick={() => navigate(`/doctors/${id}`)}
                    className="flex-1 py-2.5 border border-primary text-primary hover:bg-primary-light rounded-xl font-medium transition-colors"
                >
                    View Profile
                </button>
                <button
                    onClick={() => navigate('/book')}
                    className="flex-1 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl font-medium shadow-sm transition-colors"
                >
                    Book Visit
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
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Find a Doctor</h1>
                <p className="text-gray-500 mt-1">Search for specialists and book appointments easily.</p>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search doctors by name or specialty..."
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary transition-all shadow-sm"
                    />
                </div>
                <button className="bg-white border border-gray-200 p-3.5 rounded-2xl text-gray-600 hover:text-primary hover:border-primary/50 transition-colors shadow-sm flex items-center justify-center">
                    <Filter size={20} />
                </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
                {specialties.map(filter => (
                    <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === filter
                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/50 hover:text-primary'
                            }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.length > 0 ? (
                    filtered.map(doc => <DoctorCard key={doc.id} {...doc} />)
                ) : (
                    <p className="text-gray-400 col-span-3 text-center py-10">No doctors found.</p>
                )}
            </div>
        </div>
    );
};

export default DoctorSearch;
