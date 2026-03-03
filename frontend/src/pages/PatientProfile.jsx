import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Shield, CreditCard, Bell, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ProfileMenu = ({ icon: Icon, title, description, isActive }) => (
    <button className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${isActive
            ? 'bg-primary border-primary text-white shadow-md shadow-primary/30'
            : 'bg-white border-gray-100 text-gray-700 hover:border-primary/30 hover:shadow-sm border'
        }`}>
        <div className={`p-2.5 rounded-xl ${isActive ? 'bg-white/20' : 'bg-gray-50 text-gray-500'}`}>
            <Icon size={20} />
        </div>
        <div className="text-left flex-1">
            <h4 className={`font-semibold ${isActive ? 'text-white' : 'text-gray-900'}`}>{title}</h4>
            <p className={`text-sm ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{description}</p>
        </div>
    </button>
);

const PatientProfile = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        if (!user?.id) return;
        fetch(`http://localhost:5001/api/patients/${user.id}`)
            .then(res => res.json())
            .then(data => setProfile(data))
            .catch(err => console.error(err));
    }, [user?.id]);

    const fullName = profile
        ? `${profile.first_name} ${profile.last_name}`
        : `${user?.first_name || ''} ${user?.last_name || ''}`.trim();

    const formatDOB = (dob) => {
        if (!dob) return '—';
        const d = new Date(dob);
        const age = new Date().getFullYear() - d.getFullYear();
        return `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${age} Yrs)`;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="text-gray-500 mt-1">Manage your personal information and account settings.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-primary-light to-blue-50"></div>
                        <div className="relative">
                            <div className="w-28 h-28 mx-auto rounded-full border-4 border-white shadow-md overflow-hidden bg-white mb-4">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&size=150`} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                            <p className="text-gray-500 font-medium">Patient ID: #HS-{user?.id?.toString().padStart(4, '0')}</p>
                            <div className="flex gap-2 justify-center mt-6">
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">Verified</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <ProfileMenu icon={User} title="Personal Info" description="Update your details" isActive={true} />
                        <ProfileMenu icon={Shield} title="Medical Records" description="View past reports" />
                        <ProfileMenu icon={CreditCard} title="Payment Methods" description="Manage cards & billing" />
                        <ProfileMenu icon={Bell} title="Notifications" description="Alert preferences" />
                        <ProfileMenu icon={Settings} title="Settings" description="App settings & privacy" />
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1">Full Name</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-700 border border-gray-100">
                                    <User size={18} className="text-gray-400" />
                                    {fullName}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1">Date of Birth</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-700 border border-gray-100">
                                    <User size={18} className="text-gray-400" />
                                    {profile ? formatDOB(profile.dob) : '—'}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-900 mb-1">Email Address</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-700 border border-gray-100">
                                    <Mail size={18} className="text-gray-400" />
                                    {user?.email}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1">Phone Number</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-700 border border-gray-100">
                                    <Phone size={18} className="text-gray-400" />
                                    {profile?.phone || '—'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1">Blood Group</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-red-600 font-bold border border-gray-100">
                                    {profile?.blood_group || '—'}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-gray-900 mb-1">Address</label>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-700 border border-gray-100">
                                    <MapPin size={18} className="text-gray-400 flex-shrink-0" />
                                    {profile?.address || '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatientProfile;
