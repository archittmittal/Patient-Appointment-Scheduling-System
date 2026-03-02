import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, Heart, Star, MapPin, Clock, Award, Phone } from 'lucide-react';

const ReviewCard = ({ name, rating, date, comment, avatar }) => (
    <div className="border-b border-gray-100 py-6 last:border-0 last:pb-0">
        <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
                <img src={avatar} alt={name} className="w-10 h-10 rounded-full bg-gray-100" />
                <div>
                    <h5 className="font-semibold text-gray-900">{name}</h5>
                    <p className="text-xs text-gray-500">{date}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-medium">
                <Star size={14} className="fill-yellow-500 text-yellow-500" />
                {rating}
            </div>
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">{comment}</p>
    </div>
);

const DoctorProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // MOCK DATA based on typical doctor profile
    const doctor = {
        name: "Dr. Sarah Jenkins",
        specialty: "Cardiologist",
        degree: "MBBS, MD - Cardiology",
        experience: "15+ Years",
        rating: "4.9",
        reviews: "128",
        patients: "2.5K+",
        about: "Dr. Sarah Jenkins is a top Cardiologist with over 15 years of experience in performing complex cardiac surgeries and treating various heart conditions. She is known for her patient-centric approach and high success rates.",
        location: "Heart Care Pavilion, Block C, City Hospital",
        availability: "Mon - Fri, 09:00 AM - 05:00 PM",
        image: "https://ui-avatars.com/api/?name=Sarah+Jenkins&background=random&size=256"
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-light/40 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>

                <div className="w-40 h-40 md:w-56 md:h-56 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100 shadow-md">
                    <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold text-gray-900">{doctor.name}</h1>
                            <p className="text-lg text-primary font-medium">{doctor.specialty}</p>
                            <p className="text-gray-500 font-medium">{doctor.degree}</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="p-2.5 rounded-full bg-gray-50 text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <Heart size={20} />
                            </button>
                            <button className="p-2.5 rounded-full bg-gray-50 text-gray-600 hover:text-primary hover:bg-primary-light transition-colors">
                                <Share2 size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="bg-gray-50 p-3 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Patients</p>
                            <p className="font-semibold text-gray-900">{doctor.patients}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Experience</p>
                            <p className="font-semibold text-gray-900">{doctor.experience}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Rating</p>
                            <div className="flex items-center gap-1">
                                <p className="font-semibold text-gray-900">{doctor.rating}</p>
                                <Star size={14} className="fill-yellow-500 text-yellow-500" />
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl">
                            <p className="text-xs text-gray-500 mb-1">Reviews</p>
                            <p className="font-semibold text-gray-900">{doctor.reviews}</p>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 flex gap-4">
                        <button
                            onClick={() => navigate('/book')}
                            className="flex-1 py-3 bg-primary text-white font-medium rounded-xl shadow-sm shadow-primary/30 hover:bg-primary-hover transition-colors text-center"
                        >
                            Book Appointment
                        </button>
                        <button className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <Phone size={18} />
                            Call Clinic
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">About Doctor</h3>
                        <p className="text-gray-600 leading-relaxed">
                            {doctor.about}
                        </p>

                        <h4 className="font-bold text-gray-900 mt-8 mb-4">Working Time</h4>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-600 font-medium">Monday - Friday</span>
                                <span className="text-gray-900 font-semibold">09:00 AM - 05:00 PM</span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
                                <span className="text-gray-600 font-medium">Saturday</span>
                                <span className="text-gray-900 font-semibold">10:00 AM - 02:00 PM</span>
                            </div>
                            <div className="flex items-center justify-between text-sm p-3 bg-red-50 rounded-lg">
                                <span className="text-red-600 font-medium">Sunday</span>
                                <span className="text-red-700 font-semibold">Closed</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Patient Reviews</h3>
                            <a href="#" className="text-primary text-sm font-medium hover:underline">See All</a>
                        </div>

                        <div>
                            <ReviewCard
                                name="Alice Walker"
                                rating="5.0"
                                date="2 days ago"
                                comment="Dr. Jenkins is incredibly thorough and takes the time to explain everything clearly. Highly recommended."
                                avatar="https://ui-avatars.com/api/?name=Alice+Walker&background=random"
                            />
                            <ReviewCard
                                name="David Chen"
                                rating="4.5"
                                date="1 week ago"
                                comment="Very professional and the clinic is well-equipped. Had to wait 15 minutes past my time, but the doctor's care was worth it."
                                avatar="https://ui-avatars.com/api/?name=David+Chen&background=random"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Location</h3>
                        <div className="flex items-start gap-3 mb-6">
                            <div className="p-2 bg-primary-light text-primary rounded-lg flex-shrink-0">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <h5 className="font-semibold text-gray-900">City Hospital</h5>
                                <p className="text-sm text-gray-500 mt-1">{doctor.location}</p>
                            </div>
                        </div>
                        <div className="w-full h-48 bg-gray-200 rounded-xl overflow-hidden relative group">
                            {/* Dummy Map Visual */}
                            <div className="absolute inset-0 bg-blue-100 flex items-center justify-center">
                                <p className="text-blue-500 font-medium">Map View</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DoctorProfile;
