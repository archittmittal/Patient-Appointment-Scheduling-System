import React, { useState, useEffect, useRef } from 'react';
import { Camera, Save, Clock, CheckCircle2, AlertCircle, User, MapPin, Award, BookOpen, CalendarX, Plus, Trash2, Info, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

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

const inputClass = "w-full bg-white/5 border border-[var(--border-base)] rounded-2xl px-5 py-3.5 text-sm font-bold text-[var(--text-base)] focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white/10 transition-all duration-300 placeholder:text-slate-600 shadow-inner";

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
    const [profileMsg, setProfileMsg] = useState(null);
    const [availMsg, setAvailMsg] = useState(null);
    const [blockedDates, setBlockedDates] = useState([]);
    const [newBlockDate, setNewBlockDate] = useState('');
    const [newBlockReason, setNewBlockReason] = useState('');
    const [blockMsg, setBlockMsg] = useState(null);

    useEffect(() => {
        if (!user?.id) return;
        const fetchProfile = async () => {
            try {
                const data = await apiClient.get(`/api/doctors/${user.id}`);
                if (data) {
                    setProfile({
                        first_name: data.first_name || '',
                        last_name: data.last_name || '',
                        specialty: data.specialty || '',
                        degree: data.degree || '',
                        experience_years: data.experience_years ?? '',
                        about: data.about || '',
                        location_room: data.location_room || '',
                        image_url: data.image_url || '',
                        max_patients_per_slot: data.max_patients_per_slot ?? 15,
                    });
                    if (data.availability) {
                        const av = typeof data.availability === 'string' ? JSON.parse(data.availability) : data.availability;
                        setAvailability({ ...DEFAULT_AVAILABILITY, ...av });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch profile:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, [user?.id]);

    const fetchBlockedDates = async () => {
        if (!user?.id) return;
        try {
            const data = await apiClient.get(`/api/doctors/${user.id}/blocked-dates`);
            setBlockedDates(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch blocked dates:', err);
        }
    };

    useEffect(() => { fetchBlockedDates(); }, [user?.id]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setProfileMsg({ type: 'error', text: 'Registry error: Payload exceeds 2MB limit' }); return; }
        const r = new FileReader();
        r.onloadend = () => setProfile(prev => ({ ...prev, image_url: r.result }));
        r.readAsDataURL(file);
    };

    const handleProfileChange = e => setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const showMsg = (setter, msg) => {
        setter(msg);
        if (msg.type === 'success') setTimeout(() => setter(null), 3000);
    };

    const saveProfile = async () => {
        setSavingProfile(true);
        setProfileMsg(null);
        try {
            const updated = await apiClient.patch(`/api/doctors/${user.id}`, profile);
            if (updated && !updated.error) {
                login({ ...user, first_name: updated.first_name, last_name: updated.last_name });
                showMsg(setProfileMsg, { type: 'success', text: 'Clinical Identity Synchronized' });
            } else {
                throw new Error();
            }
        } catch {
            showMsg(setProfileMsg, { type: 'error', text: 'Registry Link Down. Data not saved.' });
        } finally { setSavingProfile(false); }
    };

    const toggleDay = (day) => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], open: !prev[day].open } }));
    const updateDayTime = (day, f, v) => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], [f]: v } }));

    const saveAvailability = async () => {
        setSavingAvail(true); setAvailMsg(null);
        try {
            const data = await apiClient.patch(`/api/doctors/${user.id}/availability`, { availability });
            if (data && !data.error) {
                showMsg(setAvailMsg, { type: 'success', text: 'Operational Window Updated' });
            } else {
                throw new Error();
            }
        } catch { showMsg(setAvailMsg, { type: 'error', text: 'Sync Error. Check connectivity.' }); }
        finally { setSavingAvail(false); }
    };

    const addBlockedDate = async () => {
        if (!newBlockDate) { showMsg(setBlockMsg, { type: 'error', text: 'Select valid timestamp' }); return; }
        setBlockMsg(null);
        try {
            const data = await apiClient.post(`/api/doctors/${user.id}/blocked-dates`, { date: newBlockDate, reason: newBlockReason || null });
            if (data && !data.error) {
                setNewBlockDate(''); setNewBlockReason(''); fetchBlockedDates();
                showMsg(setBlockMsg, { type: 'success', text: 'Clinical Downtime Indexed' });
            } else {
                throw new Error();
            }
        } catch { showMsg(setBlockMsg, { type: 'error', text: 'Exclusion Protocol Failed' }); }
    };

    const removeBlockedDate = async (id) => {
        try {
            await apiClient.delete(`/api/doctors/${user.id}/blocked-dates/${id}`);
            setBlockedDates(prev => prev.filter(d => d.id !== id));
        } catch (err) { console.error(err); }
    };

    if (isLoading) return <div className="p-20 text-center text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em]">Synchronizing Workflow Metadata...</div>;

    const avatarSrc = profile.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.first_name + '+' + profile.last_name)}&background=1e293b&color=fff&size=512`;

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 px-4 md:px-0 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 px-1">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary shadow-inner">
                        <User size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tight uppercase leading-none">Practitioner Workspace</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2 ">Clinical Identity & Schedule Administration</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 px-6 py-2.5 rounded-full border border-[var(--border-base)] shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verified credentials active</span>
                </div>
            </div>

            {/* ── PROFILE CARD ── */}
            <div className="glass-modal rounded-[3.5rem] p-10 relative overflow-hidden group border-none">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[100px] -z-10 translate-x-1/4 -translate-y-1/4 animate-pulse"></div>
                
                <div className="flex items-center justify-between mb-12">
                     <h2 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tight flex items-center gap-4 ">
                        <span className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><ShieldCheck size={20} /></span>
                        Registry Status
                    </h2>
                    {profileMsg && (
                        <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border animate-in slide-in-from-right-4 duration-500 ${profileMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {profileMsg.text}
                        </div>
                    )}
                </div>

                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Visual Cell */}
                    <div className="lg:w-1/3 space-y-8">
                        <div className="relative group/avatar mx-auto lg:mx-0 w-fit">
                            <div className="w-64 h-64 rounded-[3.5rem] overflow-hidden border-4 border-white/5 shadow-2xl relative bg-slate-900/40 p-1">
                                <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover rounded-[3.2rem] opacity-90 transition-all duration-700 group-hover/avatar:scale-110 group-hover/avatar:opacity-100" />
                                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileRef.current?.click()}>
                                    <Camera size={48} className="text-white transform scale-75 group-hover/avatar:scale-100 transition-transform" />
                                </div>
                            </div>
                            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-4 -right-4 bg-primary text-white p-5 rounded-[1.5rem] shadow-xl hover:bg-primary-hover hover:scale-110 transition-all border-4 border-[var(--bg-base)] active:scale-95 group/cam">
                                <Camera size={24} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
                            </button>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        </div>
                        <div className="bg-primary-light/5 rounded-[2.5rem] p-8 border border-[var(--border-base)] space-y-4">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">UI Visual Protocol</p>
                            <h4 className="text-sm font-black text-[var(--text-base)] uppercase tracking-tight ">Registry Portrait</h4>
                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">High-contrast clinical portraits optimize trust metrics. Ensure subject clarity and clinical grade lighting.</p>
                        </div>
                    </div>

                    {/* Data Matrix */}
                    <div className="flex-1 space-y-8">
                        <div className="grid md:grid-cols-2 gap-8">
                            <Field label="Identification Primary" name="first_name" value={profile.first_name} onChange={handleProfileChange} icon={<User size={18} />} placeholder="FIRST NAME" />
                            <Field label="Identification Secondary" name="last_name" value={profile.last_name} onChange={handleProfileChange} placeholder="LAST NAME" />
                            <Field label="Specialist Core" name="specialty" value={profile.specialty} onChange={handleProfileChange} icon={<Award size={18} />} placeholder="e.g. NEUROLOGIST" />
                            <Field label="Academic Weight" name="degree" value={profile.degree} onChange={handleProfileChange} icon={<BookOpen size={18} />} placeholder="e.g. MB, BCh, M.Sc" />
                            <Field label="Clinical Tenure (Years)" name="experience_years" type="number" value={profile.experience_years} onChange={handleProfileChange} placeholder="0" />
                            <Field label="Neural Buffer Capacity" name="max_patients_per_slot" type="number" value={profile.max_patients_per_slot} onChange={handleProfileChange} subLabel="PAX per clinical window" placeholder="15" />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 ">Physical Deployment Zone</label>
                            <div className="relative group/input">
                                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-primary transition-colors" size={20} />
                                <input name="location_room" value={profile.location_room} onChange={handleProfileChange} className="w-full pl-16 pr-6 py-5 bg-white/5 border border-[var(--border-base)] rounded-3xl text-sm font-bold text-[var(--text-base)] focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all shadow-inner uppercase tracking-widest" placeholder="FACILITY COORDINATES" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 ">Clinical Biography (Neural Sync)</label>
                            <textarea name="about" value={profile.about} onChange={handleProfileChange} rows={5} className="w-full bg-white/5 border border-[var(--border-base)] rounded-[2.5rem] px-8 py-6 text-sm font-bold text-[var(--text-base)] focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all shadow-inner resize-none " placeholder="ENCRYPT PROFESSIONAL HISTORY..." />
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary px-12 py-5 font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 active:scale-95 disabled:opacity-50 flex items-center gap-4 transition-all group">
                                {savingProfile ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={20} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />}
                                {savingProfile ? 'SYNCHRONIZING...' : 'UPDATE IDENTITY'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SCHEDULE ── */}
            <div className="grid lg:grid-cols-2 gap-10">
                <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-[100px] -z-10 -translate-x-1/4 -translate-y-1/4 animate-pulse"></div>
                    <div className="flex items-center justify-between mb-10">
                         <h2 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tight flex items-center gap-4 ">
                            <span className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Clock size={20} /></span>
                            Operational Grid
                        </h2>
                        {availMsg && <span className="text-[9px] font-black uppercase text-emerald-500">{availMsg.text}</span>}
                    </div>
                    
                    <div className="space-y-3">
                        {DAYS.map(day => {
                            const slot = availability[day];
                            return (
                                <div key={day} className={`flex items-center gap-4 p-5 rounded-[2rem] border transition-all duration-500 ${slot.open ? 'bg-white/5 border-[var(--border-base)] group-hover:border-primary/20' : 'bg-rose-500/5 border-rose-500/10 opacity-40'}`}>
                                    <div className="w-16 flex-shrink-0"><p className={`text-[10px] font-black uppercase tracking-[0.2em] ${slot.open ? 'text-primary' : 'text-slate-500'}`}>{DAY_LABELS[day]}</p></div>
                                    <button onClick={() => toggleDay(day)} className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-500 ${slot.open ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-white/10'}`}>
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-500 ${slot.open ? 'translate-x-7' : 'translate-x-1'}`} />
                                    </button>
                                    {slot.open ? (
                                        <div className="flex items-center gap-3 flex-1 justify-end">
                                            <input type="time" value={slot.from} onChange={e => updateDayTime(day, 'from', e.target.value)} className="bg-white/5 border border-[var(--border-base)] rounded-xl px-3 py-2 text-[10px] font-black text-[var(--text-base)] focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                                            <span className="text-slate-500 font-black">—</span>
                                            <input type="time" value={slot.to} onChange={e => updateDayTime(day, 'to', e.target.value)} className="bg-white/5 border border-[var(--border-base)] rounded-xl px-3 py-2 text-[10px] font-black text-[var(--text-base)] focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                                        </div>
                                    ) : <div className="flex-1 text-right text-[9px] font-black text-rose-500 uppercase tracking-widest opacity-60">Facility Offline</div>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-8 flex justify-end">
                        <button onClick={saveAvailability} disabled={savingAvail} className="btn-secondary px-8 py-4 font-black text-[9px] uppercase tracking-widest border-[var(--border-base)] text-slate-500 hover:text-primary transition-all flex items-center gap-3">
                            <Save size={16} /> {savingAvail ? 'SYNCING...' : 'SAVE GRID'}
                        </button>
                    </div>
                </div>

                {/* ── DOWNTIME ── */}
                <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute bottom-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-[100px] -z-10 translate-x-1/4 translate-y-1/4 animate-pulse"></div>
                    <div className="flex items-center justify-between mb-10">
                         <h2 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tight flex items-center gap-4 ">
                            <span className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner"><CalendarX size={20} /></span>
                            Clinical Downtime
                        </h2>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 bg-rose-500/5 rounded-[2.5rem] border border-rose-500/10 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1">Exclusion Timestamp</label>
                                <input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full bg-white/5 border border-rose-500/20 rounded-2xl px-5 py-3 text-[10px] font-black text-[var(--text-base)] focus:ring-2 focus:ring-rose-500/30 outline-none appearance-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1">Neural Narrative (Reason)</label>
                                <input type="text" value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} placeholder="e.g. ANNUAL LEAVE CYCLE" className="w-full bg-white/5 border border-rose-500/20 rounded-2xl px-5 py-3 text-[10px] font-black text-[var(--text-base)] focus:ring-2 focus:ring-rose-500/30 outline-none placeholder:text-rose-500/40" />
                            </div>
                            <button onClick={addBlockedDate} className="w-full py-4 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-500/20 hover:bg-rose-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <Plus size={16} strokeWidth={3} /> INITIALIZE DOWNTIME
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {blockedDates.length === 0 ? (
                                <div className="py-12 text-center opacity-30 ">
                                    <Sparkles size={32} className="mx-auto text-slate-500 mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No Active Downtime Nodes</p>
                                </div>
                            ) : blockedDates.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-5 bg-white/5 border border-rose-500/10 rounded-[2rem] hover:border-rose-500/30 transition-all group/item">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-tighter leading-none ">{new Date(d.blocked_date).toLocaleDateString()}</p>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{d.reason || 'UNSPECIFIED LEAVE'}</p>
                                    </div>
                                    <button onClick={() => removeBlockedDate(d.id)} className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-500/20">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Field = ({ label, icon, subLabel, ...props }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 leading-none">{label}</label>
        <div className="relative group/input">
            {icon && <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-primary transition-colors">{icon}</div>}
            <input {...props} className={`${inputClass} ${icon ? 'pl-16' : 'px-6'} uppercase tracking-widest `} />
        </div>
        {subLabel && <p className="text-[9px] font-bold text-slate-500 mt-2 ml-2 opacity-60">{subLabel}</p>}
    </div>
);

export default DoctorProfileEdit;
