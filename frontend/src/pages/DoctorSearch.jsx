import React, { useState } from 'react';
import { Search, MapPin, Star, Filter, Calendar as CalendarIcon } from 'lucide-react';

const DoctorCard = ({ name, specialty, rating, reviews, location, availableDate, image }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
        <div className="flex gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                <img src={image} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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

                <div className="mt-3 space-y-1.5 cursor-default">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin size={16} />
                        {location}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <CalendarIcon size={16} />
                        Next slot: <span className="font-medium text-gray-900">{availableDate}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-6 flex gap-3">
            <button className="flex-1 py-2.5 border border-primary text-primary hover:bg-primary-light rounded-xl font-medium transition-colors">
                View Profile
            </button>
            <button className="flex-1 py-2.5 bg-primary text-white hover:bg-primary-hover rounded-xl font-medium shadow-sm transition-colors">
                Book Visit
            </button>
        </div>
    </div>
);

const DoctorSearch = () => {
    const [activeFilter, setActiveFilter] = useState('All');

    const filters = ['All', 'Cardiologist', 'Dentist', 'Neurologist', 'General Physician', 'Orthopedic'];

    const dummyDoctors = [
        {
            name: "Dr. Sarah Jenkins",
            specialty: "Cardiologist",
            rating: "4.9",
            reviews: "128",
            location: "Heart Care Pavilion, Block C",
            availableDate: "Tomorrow, 10:00 AM",
            image: "https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random"
        },
        {
            name: "Dr. Michael Chen",
            specialty: "General Physician",
            rating: "4.8",
            reviews: "256",
            location: "Central Clinic, Room 102",
            availableDate: "Today, 02:30 PM",
            image: "https://ui-avatars.com/api/?name=Michael+Chen&background=random"
        },
        {
            name: "Dr. Emily Davis",
            specialty: "Neurologist",
            rating: "4.7",
            reviews: "89",
            location: "Neuro Sciences Center",
            availableDate: "Oct 26, 09:00 AM",
            image: "https://ui-avatars.com/api/?name=Emily+Davis&background=random"
        },
        {
            name: "Dr. Robert Smith",
            specialty: "Orthopedic",
            rating: "4.9",
            reviews: "150",
            location: "Bone & Joint Clinic",
            availableDate: "Oct 28, 11:15 AM",
            image: "https://ui-avatars.com/api/?name=Robert+Smith&background=random"
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Find a Doctor</h1>
                <p className="text-gray-500 mt-1">Search for specialists and book appointments easily.</p>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search doctors, clinics, hospitals, etc."
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary transition-all shadow-sm"
                    />
                </div>
                <button className="bg-white border border-gray-200 p-3.5 rounded-2xl text-gray-600 hover:text-primary hover:border-primary/50 transition-colors shadow-sm flex items-center justify-center">
                    <Filter size={20} />
                </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {filters.map(filter => (
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
                {dummyDoctors.map(doc => (
                    <DoctorCard key={doc.name} {...doc} />
                ))}
            </div>
        </div>
    );
};

export default DoctorSearch;
