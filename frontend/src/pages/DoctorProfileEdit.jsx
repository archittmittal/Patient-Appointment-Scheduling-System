import React, { useState, useEffect, useRef } from 'react';
import { Camera, Save, Clock, CheckCircle2, AlertCircle, User, MapPin, Award, BookOpen, CalendarX, Plus, Trash2 } from 'lucide-react';
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

const inputClass = "w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all duration-300 placeholder:text-slate-300";

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
    const [blockedDates, setBlockedDates] = useState([]);
    const [newBlockDate, setNewBlockDate] = useState('');
    const [newBlockReason, setNewBlockReason] = useState('');
    const [blockMsg, setBlockMsg] = useState(null);

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

    const fetchBlockedDates = () => {
        if (!user?.id) return;
        fetch(`http://localhost:5001/api/doctors/${user.id}/blocked-dates`)
            .then(r => r.json())
            .then(data => setBlockedDates(Array.isArray(data) ? data : []))
            .catch(err => console.error(err));
    };

    useEffect(() => { fetchBlockedDates(); }, [user?.id]);

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

    const addBlockedDate = async () => {
        if (!newBlockDate) {
            setBlockMsg({ type: 'error', text: 'Please select a date to block.' });
            return;
        }
        setBlockMsg(null);
        try {
            const res = await fetch(`http://localhost:5001/api/doctors/${user.id}/blocked-dates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: newBlockDate, reason: newBlockReason || null }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed');
            }
            setNewBlockDate('');
            setNewBlockReason('');
            fetchBlockedDates();
            showMsg(setBlockMsg, { type: 'success', text: 'Date blocked successfully.' });
        } catch (err) {
            setBlockMsg({ type: 'error', text: err.message });
        }
    };

    const removeBlockedDate = async (id) => {
        try {
            await fetch(`http://localhost:5001/api/doctors/${user.id}/blocked-dates/${id}`, {
                method: 'DELETE',
            });
            setBlockedDates(prev => prev.filter(d => d.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    if (isLoading) {
        return <div className="p-10 text-center text-gray-400 animate-pulse">Loading profile...</div>;
    }

    const avatarSrc = profile.image_url ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.first_name + '+' + profile.last_name)}&background=random&size=200`;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 px-4 md:px-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <User size={20} strokeWidth={2.5} />
                        </span>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Practitioner Profile</h1>
                    </div>
                    <p className="text-slate-400 font-bold text-sm">Manage your professional identity and clinical availability.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Status Verified
                    </span>
                </div>
            </div>

            {/* ── PROFILE CARD ── */}
            <div className="glass-card p-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
                
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-10 flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                    Clinical Identity
                </h2>

                {profileMsg && (
                    <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-black uppercase tracking-wide border transition-all ${profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {profileMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {profileMsg.text}
                    </div>
                )}

                {/* Photo upload */}
                <div className="flex flex-col md:flex-row md:items-center gap-10 mb-12 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100/50">
                    <div className="relative group/avatar">
                        <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative">
                            <img
                                src={avatarSrc}
                                alt="Profile"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileRef.current?.click()}>
                                <Camera size={32} className="text-white transform scale-75 group-hover/avatar:scale-100 transition-transform" />
                            </div>
                        </div>
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="absolute -bottom-3 -right-3 bg-indigo-600 text-white p-3.5 rounded-2xl shadow-xl hover:bg-indigo-700 hover:scale-110 transition-all border-4 border-white active:scale-95"
                        >
                            <Camera size={20} strokeWidth={2.5} />
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                    </div>
                    <div className="space-y-3">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Profile Portrait</p>
                        <h4 className="text-lg font-black text-slate-900">Your visual clinical identity</h4>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed max-w-sm">
                            Enhanced visual presence increases patient trust. High-resolution portraits with clear clinical backgrounds are recommended. <br/>
                            <span className="text-indigo-600 text-[10px] uppercase tracking-widest mt-2 block">Max File Size: 2 MB</span>
                        </p>
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-5 py-2.5 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100"
                        >
                            Upload Professional Photo
                        </button>
                    </div>
                </div>

                {/* Form fields */}
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">First Name</label>
                        <div className="relative group">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input name="first_name" value={profile.first_name} onChange={handleProfileChange}
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all duration-300" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Last Name</label>
                        <input name="last_name" value={profile.last_name} onChange={handleProfileChange} className={inputClass} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Specialization</label>
                        <div className="relative group">
                            <Award className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input name="specialty" value={profile.specialty} onChange={handleProfileChange}
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all duration-300"
                                placeholder="e.g. Cardiologist" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Academic Degree</label>
                        <div className="relative group">
                            <BookOpen className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input name="degree" value={profile.degree} onChange={handleProfileChange}
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all duration-300"
                                placeholder="e.g. MBBS, MD" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Years of Experience</label>
                        <input name="experience_years" type="number" min={0} value={profile.experience_years} onChange={handleProfileChange} className={inputClass} placeholder="e.g. 10" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Booking Capacity</label>
                        <div className="relative group">
                            <Plus className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input
                                name="max_patients_per_slot"
                                type="number"
                                min={1}
                                max={100}
                                value={profile.max_patients_per_slot}
                                onChange={handleProfileChange}
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all duration-300"
                                placeholder="e.g. 15"
                            />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 ml-2 italic">Maximum patients allowed per 60-minute window.</p>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Clinical Location</label>
                        <div className="relative group">
                            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input name="location_room" value={profile.location_room} onChange={handleProfileChange}
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all duration-300"
                                placeholder="e.g. Hospital Wing B, Room 402" />
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Professional Biography</label>
                        <textarea name="about" value={profile.about} onChange={handleProfileChange} rows={5}
                            className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all duration-300 resize-none"
                            placeholder="Brief description of your expertise and clinical approach..." />
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={saveProfile}
                        disabled={savingProfile}
                        className="btn-primary px-10 py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-3"
                    >
                        {savingProfile ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : <Save size={18} strokeWidth={2.5} />}
                        {savingProfile ? 'Synchronizing...' : 'Save Clinical Profile'}
                    </button>
                </div>
            </div>

            {/* ── AVAILABILITY / SCHEDULE ── */}
            <div className="glass-card p-10 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10 -translate-y-1/2 -translate-x-1/2"></div>
                
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                    Clinical Calendar
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10 ml-4">Establish your weekly operational window.</p>

                {availMsg && (
                    <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-black uppercase tracking-wide border transition-all ${availMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {availMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {availMsg.text}
                    </div>
                )}

                <div className="space-y-4">
                    {DAYS.map(day => {
                        const slot = availability[day];
                        return (
                            <div
                                key={day}
                                className={`flex flex-col sm:flex-row items-center gap-6 p-6 rounded-[2rem] border transition-all duration-300 ${slot.open ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}
                            >
                                <div className="w-24 flex-shrink-0">
                                    <p className={`text-xs font-black uppercase tracking-[0.2em] ${slot.open ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {DAY_LABELS[day]}
                                    </p>
                                </div>

                                <button
                                    onClick={() => toggleDay(day)}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-500 flex-shrink-0 shadow-inner ${slot.open ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-500 ${slot.open ? 'translate-x-8' : 'translate-x-1'}`} />
                                </button>

                                {slot.open ? (
                                    <div className="flex items-center gap-4 flex-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available From</span>
                                        <input
                                            type="time"
                                            value={slot.from}
                                            onChange={e => updateDayTime(day, 'from', e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                        />
                                        <span className="text-slate-300 font-bold">—</span>
                                        <input
                                            type="time"
                                            value={slot.to}
                                            onChange={e => updateDayTime(day, 'to', e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center gap-2">
                                        <CalendarX size={14} className="text-slate-400" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Facility Closed</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-10 pt-8 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={saveAvailability}
                        disabled={savingAvail}
                        className="btn-primary px-10 py-4 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-3"
                    >
                        {savingAvail ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : <Save size={18} strokeWidth={2.5} />}
                        {savingAvail ? 'Synchronizing...' : 'Save Weekly Schedule'}
                    </button>
                </div>
            </div>

            {/* ── BLOCKED DATES ── */}
            <div className="glass-card p-10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50/30 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2"></div>
                
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-rose-500 rounded-full"></span>
                    Clinical Downtime
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10 ml-4">Block specific dates for professional leave or facility maintenance.</p>

                {blockMsg && (
                    <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 text-sm font-black uppercase tracking-wide border transition-all ${blockMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {blockMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {blockMsg.text}
                    </div>
                )}

                {/* Add new blocked date */}
                <div className="flex flex-col md:flex-row gap-4 mb-10 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100/50 items-end">
                    <div className="flex-1 space-y-2 w-full">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Unavailable Date</label>
                        <input
                            type="date"
                            value={newBlockDate}
                            onChange={e => setNewBlockDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex-[2] space-y-2 w-full">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Exclusion Reason</label>
                        <input
                            type="text"
                            value={newBlockReason}
                            onChange={e => setNewBlockReason(e.target.value)}
                            placeholder="e.g. Annual Leave, Medical Conference"
                            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-400 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={addBlockedDate}
                        className="btn-primary bg-rose-600 hover:bg-rose-700 px-8 py-4 font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 flex items-center gap-2 h-[54px]"
                    >
                        <Plus size={18} /> Block Date
                    </button>
                </div>

                {/* Existing blocked dates */}
                {blockedDates.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50/30 rounded-[2.5rem] border border-dashed border-slate-200">
                        <Calendar className="mx-auto text-slate-200 mb-4" size={48} strokeWidth={1} />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No scheduled downtime</p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                        {blockedDates.map(d => (
                            <div key={d.id} className="group relative overflow-hidden bg-rose-50/50 border border-rose-100 p-6 rounded-[2rem] transition-all hover:shadow-lg hover:shadow-rose-500/5 hover:-translate-y-1">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-2">Unavailable</p>
                                        <h4 className="text-sm font-black text-rose-900 leading-tight">
                                            {new Date(d.blocked_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                        </h4>
                                        {d.reason && (
                                            <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5 mt-2">
                                                <Info size={12} /> {d.reason}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeBlockedDate(d.id)}
                                        className="w-10 h-10 rounded-xl bg-white text-rose-400 hover:text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-all shadow-sm border border-rose-100"
                                        title="Unblock this date"
                                    >
                                        <Trash2 size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DoctorProfileEdit;
