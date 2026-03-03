import React, { useState, useEffect, useRef } from 'react';
import { Camera, Save, Clock, CheckCircle2, AlertCircle, User, MapPin, Award, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

const DEFAULT_AVAILABILITY = {
    monday:    { open: true,  from: '09:00', to: '17:00' },
    tuesday:   { open: true,  from: '09:00', to: '17:00' },
    wednesday: { open: true,  from: '09:00', to: '17:00' },
    thursday:  { open: true,  from: '09:00', to: '17:00' },
    friday:    { open: true,  from: '09:00', to: '17:00' },
    saturday:  { open: true,  from: '10:00', to: '14:00' },
    sunday:    { open: false, from: '',      to: ''       },
};

const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50 transition-colors";

const DoctorProfileEdit = () => {
    const { user, login } = useAuth();
    const fileRef = useRef(null);

    const [profile, setProfile] = useState({
        first_name: '', last_name: '', specialty: '', degree: '',
        experience_years: '', about: '', location_room: '', image_url: '',
        max_patients_per_slot: 15,
    });
    const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
    const [isLoading, setIsLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingAvail, setSavingAvail] = useState(false);
    const [profileMsg, setProfileMsg] = useState(null);  // {type:'success'|'error', text}
    const [availMsg, setAvailMsg]     = useState(null);

    // Load current doctor data
    useEffect(() => {
        if (!user?.id) return;
        fetch(`${API}/api/doctors/${user.id}`)
            .then(res => res.json())
            .then(data => {
                setProfile({
                    first_name:       data.first_name      || '',
                    last_name:        data.last_name       || '',
                    specialty:        data.specialty       || '',
                    degree:           data.degree          || '',
                    experience_years: data.experience_years ?? '',
                    about:            data.about           || '',
                    location_room:    data.location_room   || '',
                    image_url:              data.image_url            || '',
                    max_patients_per_slot:  data.max_patients_per_slot ?? 15,
                });
                if (data.availability) {
                    const av = typeof data.availability === 'string'
                        ? JSON.parse(data.availability)
                        : data.availability;
                    setAvailability({ ...DEFAULT_AVAILABILITY, ...av });
                }
            })
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, [user?.id]);

    // Handle photo file pick — convert to base64
    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setProfileMsg({ type: 'error', text: 'Image must be under 2 MB' });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => setProfile(prev => ({ ...prev, image_url: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleProfileChange = e =>
        setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const showMsg = (setter, msg) => {
        setter(msg);
        if (msg.type === 'success') {
            setTimeout(() => setter(null), 3000);
        }
    };

    const saveProfile = async () => {
        setSavingProfile(true);
        setProfileMsg(null);
        try {
            const res = await fetch(`${API}/api/doctors/${user.id}`, {
                method: 'PATCH',
                headers: authedHeaders(true),
                body: JSON.stringify(profile),
            });
            if (!res.ok) throw new Error('Failed');
            const updated = await res.json();
            // Keep auth name in sync
            login({ ...user, first_name: updated.first_name, last_name: updated.last_name });
            showMsg(setProfileMsg, { type: 'success', text: 'Profile saved successfully!' });
        } catch {
            showMsg(setProfileMsg, { type: 'error', text: 'Failed to save profile. Try again.' });
        } finally {
            setSavingProfile(false);
        }
    };

    const toggleDay = (day) =>
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], open: !prev[day].open }
        }));

    const updateDayTime = (day, field, value) =>
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));

    const saveAvailability = async () => {
        setSavingAvail(true);
        setAvailMsg(null);
        try {
            const res = await fetch(`${API}/api/doctors/${user.id}/availability`, {
                method: 'PATCH',
                headers: authedHeaders(true),
                body: JSON.stringify({ availability }),
            });
            if (!res.ok) throw new Error('Failed');
            showMsg(setAvailMsg, { type: 'success', text: 'Schedule saved successfully!' });
        } catch {
            showMsg(setAvailMsg, { type: 'error', text: 'Failed to save schedule. Try again.' });
        } finally {
            setSavingAvail(false);
        }
    };

    if (isLoading) {
        return <div className="p-10 text-center text-gray-400 animate-pulse">Loading profile...</div>;
    }

    const avatarSrc = profile.image_url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.first_name + '+' + profile.last_name)}&background=random&size=200`;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="text-gray-500 mt-1">Update your information, photo, and availability. Changes are instantly visible to patients.</p>
            </div>

            {/* ── PROFILE CARD ── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <User size={20} className="text-primary" /> Profile Information
                </h2>

                {profileMsg && (
                    <div className={`mb-6 p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${profileMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {profileMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {profileMsg.text}
                    </div>
                )}

                {/* Photo upload */}
                <div className="flex items-center gap-6 mb-8">
                    <div className="relative">
                        <img
                            src={avatarSrc}
                            alt="Profile"
                            className="w-24 h-24 rounded-2xl object-cover border-2 border-primary/20 shadow-md"
                        />
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-xl shadow-md hover:bg-primary-hover transition-colors"
                        >
                            <Camera size={14} />
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">Profile Photo</p>
                        <p className="text-xs text-gray-400 mt-1">Click the camera icon to upload. Max 2 MB.<br/>Photo will be visible to patients when they search for doctors.</p>
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="mt-2 text-xs text-primary font-medium hover:underline"
                        >
                            Change Photo
                        </button>
                    </div>
                </div>

                {/* Form fields */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input name="first_name" value={profile.first_name} onChange={handleProfileChange}
                                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                        <input name="last_name" value={profile.last_name} onChange={handleProfileChange} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Specialty</label>
                        <div className="relative">
                            <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input name="specialty" value={profile.specialty} onChange={handleProfileChange}
                                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                placeholder="e.g. Cardiologist" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Degree / Qualification</label>
                        <div className="relative">
                            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input name="degree" value={profile.degree} onChange={handleProfileChange}
                                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                placeholder="e.g. MBBS, MD" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Experience (years)</label>
                        <input name="experience_years" type="number" min={0} value={profile.experience_years} onChange={handleProfileChange} className={inputClass} placeholder="e.g. 10" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Max Patients per Hour Slot</label>
                        <input
                            name="max_patients_per_slot"
                            type="number"
                            min={1}
                            max={100}
                            value={profile.max_patients_per_slot}
                            onChange={handleProfileChange}
                            className={inputClass}
                            placeholder="e.g. 15"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Max bookings allowed per 1-hour slot.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Room / Location</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input name="location_room" value={profile.location_room} onChange={handleProfileChange}
                                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                placeholder="e.g. Block C, Room 302" />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">About / Bio</label>
                        <textarea name="about" value={profile.about} onChange={handleProfileChange} rows={4}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50 resize-none"
                            placeholder="Write a short bio visible on your public profile..." />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={saveProfile}
                        disabled={savingProfile}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-sm shadow-primary/30"
                    >
                        <Save size={16} />
                        {savingProfile ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>

            {/* ── AVAILABILITY / SCHEDULE ── */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Clock size={20} className="text-primary" /> Weekly Availability
                </h2>
                <p className="text-sm text-gray-500 mb-6">Set when you are open. Patients will see these hours on your profile.</p>

                {availMsg && (
                    <div className={`mb-6 p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${availMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {availMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {availMsg.text}
                    </div>
                )}

                <div className="space-y-3">
                    {DAYS.map(day => {
                        const slot = availability[day];
                        return (
                            <div
                                key={day}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${slot.open ? 'bg-primary-light/20 border-primary/20' : 'bg-gray-50 border-gray-100'}`}
                            >
                                {/* Day name + toggle */}
                                <div className="w-16 flex-shrink-0">
                                    <p className={`text-sm font-bold capitalize ${slot.open ? 'text-primary' : 'text-gray-400'}`}>
                                        {DAY_LABELS[day]}
                                    </p>
                                </div>

                                {/* Toggle switch */}
                                <button
                                    onClick={() => toggleDay(day)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${slot.open ? 'bg-primary' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${slot.open ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>

                                {/* Time inputs */}
                                {slot.open ? (
                                    <div className="flex items-center gap-3 flex-1">
                                        <span className="text-xs text-gray-500 font-medium">Open</span>
                                        <input
                                            type="time"
                                            value={slot.from}
                                            onChange={e => updateDayTime(day, 'from', e.target.value)}
                                            className="border border-primary/30 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                                        />
                                        <span className="text-gray-400 text-sm">to</span>
                                        <input
                                            type="time"
                                            value={slot.to}
                                            onChange={e => updateDayTime(day, 'to', e.target.value)}
                                            className="border border-primary/30 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic flex-1">Closed</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={saveAvailability}
                        disabled={savingAvail}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-sm shadow-primary/30"
                    >
                        <Save size={16} />
                        {savingAvail ? 'Saving...' : 'Save Schedule'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DoctorProfileEdit;
