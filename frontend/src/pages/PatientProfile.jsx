import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Shield, CreditCard, Bell, Settings, Save, X, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API } from '../config/api';
import { Pill, Activity, Calendar as CalendarIcon, ChevronRight, FileText, Download, Printer } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const inputClass = "w-full glass-card border-slate-100 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 bg-white/50 font-bold text-slate-900 transition-all placeholder:text-slate-300";

const ProfileMenu = ({ icon: Icon, title, description, isActive }) => (
    <button className={`w-full flex items-center gap-4 p-5 rounded-[2rem] transition-all duration-300 group ${isActive
            ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 -translate-y-1'
            : 'glass-card border-slate-100 text-slate-600 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5'
        }`}>
        <div className={`p-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-white/20' : 'bg-slate-50 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50'}`}>
            <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className="text-left flex-1">
            <h4 className={`font-black text-sm tracking-tight ${isActive ? 'text-white' : 'text-slate-900'}`}>{title}</h4>
            <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{description}</p>
        </div>
    </button>
);

const PatientProfile = () => {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null); // {type:'success'|'error', text}
    const [pastVisits, setPastVisits] = useState([]);
    const [latestFollowup, setLatestFollowup] = useState(null);
    const [activeVisit, setActiveVisit] = useState(null);

    useEffect(() => {
        if (!user?.id) return;
        fetch(`${API}/api/patients/${user.id}`)
            .then(res => res.json())
            .then(data => setProfile(data))
            .catch(err => console.error(err));

        fetch(`${API}/api/patients/${user.id}/appointments?type=past`)
            .then(res => res.json())
            .then(data => {
                const visits = Array.isArray(data) ? data : [];
                setPastVisits(visits);
                
                // Find latest follow-up
                const withFollowup = visits
                    .filter(a => a.follow_up_date && new Date(a.follow_up_date) >= new Date())
                    .sort((a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date));
                setLatestFollowup(withFollowup[0] || null);
            })
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

    const startEdit = () => {
        setForm({
            first_name:  profile?.first_name  || '',
            last_name:   profile?.last_name   || '',
            phone:       profile?.phone       || '',
            address:     profile?.address     || '',
            blood_group: profile?.blood_group || '',
        });
        setSaveMsg(null);
        setIsEditing(true);
    };

    const cancelEdit = () => { setIsEditing(false); setSaveMsg(null); };

    const handleSave = async () => {
        setSaving(true);
        setSaveMsg(null);
        try {
            const res = await fetch(`${API}/api/patients/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error('Failed');
            const updated = await res.json();
            setProfile(updated);
            login({ ...user, first_name: updated.first_name, last_name: updated.last_name });
            setIsEditing(false);
            setSaveMsg({ type: 'success', text: 'Profile updated successfully!' });
            setTimeout(() => setSaveMsg(null), 3000);
        } catch {
            setSaveMsg({ type: 'error', text: 'Failed to save. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const Field = ({ label, icon: Icon, value, editContent }) => (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{label}</label>
            {isEditing && editContent ? editContent : (
                <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl text-slate-700 border border-slate-100/50 hover:bg-white hover:border-indigo-100 transition-all duration-300 group">
                    {Icon && <Icon size={18} strokeWidth={2.5} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />}
                    <span className="text-sm font-bold text-slate-900">{value || '—'}</span>
                </div>
            )}
        </div>
    );

    const PrescriptionModal = ({ visit, onClose }) => {
        if (!visit) return null;
        const date = new Date(visit.appointment_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="glass-modal rounded-[2.5rem] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                    {/* Medical Header */}
                    <div className="p-10 bg-white/80 border-b border-slate-100 relative">
                        <button onClick={onClose} className="absolute top-8 right-8 p-3 text-slate-400 hover:text-slate-900 rounded-2xl hover:bg-slate-100 transition-all active:scale-95">
                            <X size={20} strokeWidth={2.5} />
                        </button>
                        <div className="flex items-center gap-5 mb-6">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                                <Activity size={32} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Clinical Report</h2>
                                <p className="text-indigo-600 text-[11px] font-black uppercase tracking-[0.2em] mt-1">HS Medical Advanced Analytics</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-y-3 gap-x-8 text-sm text-slate-500 font-bold">
                            <span className="flex items-center gap-2"><CalendarIcon size={16} className="text-indigo-600" /> {date}</span>
                            <span className="flex items-center gap-2"><User size={16} className="text-indigo-600" /> Dr. {visit.doc_first} {visit.doc_last}</span>
                        </div>
                    </div>

                    <div className="p-10 space-y-10 overflow-y-auto custom-scrollbar flex-1 bg-white/30">
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Diagnosis & Observations
                            </h4>
                            <div className="p-6 glass-card rounded-3xl border-slate-100 italic text-slate-700 leading-relaxed shadow-xl shadow-indigo-500/5">
                                {visit.diagnosis || 'No specific diagnosis recorded.'}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Medication & Rx
                            </h4>
                            <div className="p-8 bg-white/80 rounded-3xl border-2 border-dashed border-slate-200 shadow-inner">
                                <div className="whitespace-pre-wrap font-mono text-sm text-slate-600 leading-relaxed font-bold">
                                    {visit.prescription || 'No medications prescribed.'}
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Clinical Notes
                            </h4>
                            <p className="text-slate-500 text-sm leading-relaxed px-1 font-medium">
                                {visit.notes || 'Routine follow-up advised.'}
                            </p>
                        </section>

                        <div className="pt-10 border-t border-slate-100 flex justify-between items-end">
                            <div className="flex-1 space-y-4">
                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Medical Verification</p>
                                <p className="font-serif italic text-2xl text-slate-900 tracking-tight">Dr. {visit.doc_first} {visit.doc_last}</p>
                                <p className="text-xs text-indigo-600 font-black uppercase tracking-widest">{visit.specialty}</p>
                            </div>
                            <div className="flex gap-4">
                                <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95">
                                    <Printer size={20} />
                                </button>
                                <button className="btn-primary py-4 px-8 text-sm font-bold shadow-2xl shadow-indigo-500/20">
                                    <Download size={18} className="mr-2" /> Download Document
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Account & Security</h1>
                <p className="text-slate-500 font-medium mt-1">Manage your medical profile and security preferences.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                    <div className="glass-card rounded-[2.5rem] p-10 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-600/10 to-transparent"></div>
                        <div className="relative">
                            <div className="w-32 h-32 mx-auto rounded-[2rem] border-4 border-white shadow-2xl overflow-hidden bg-white mb-6 transform hover:rotate-3 transition-transform duration-500">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=1e1b4b&color=fff&size=200&bold=true`} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{fullName}</h2>
                            <p className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em] mt-2">Patient ID: #HS-{user?.id?.toString().padStart(4, '0')}</p>
                            <div className="flex gap-2 justify-center mt-8">
                                <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm">Verified Account</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div onClick={() => document.getElementById('personal-info')?.scrollIntoView({ behavior: 'smooth' })}>
                            <ProfileMenu icon={User} title="Personal Info" description="Edit your details" isActive={true} />
                        </div>
                        <div onClick={() => document.getElementById('medical-history')?.scrollIntoView({ behavior: 'smooth' })}>
                            <ProfileMenu icon={Shield} title="Medical Records" description="View past reports" />
                        </div>
                        <ProfileMenu icon={Bell} title="Notifications" description="Email and SMS alerts" />
                        <ProfileMenu icon={Lock} title="Privacy" description="Security settings" />
                        <ProfileMenu icon={Settings} title="Settings" description="App settings & privacy" />
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div id="personal-info" className="glass-card rounded-[2.5rem] p-10">
                        <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase tracking-widest">Personal Information</h3>
                            {!isEditing ? (
                                <button
                                    onClick={startEdit}
                                    className="px-6 py-2.5 text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                >
                                    EDIT PROFILE
                                </button>
                            ) : (
                                <div className="flex gap-3">
                                    <button onClick={cancelEdit} className="px-5 py-2.5 text-xs font-black text-slate-400 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2">
                                        <X size={14} strokeWidth={3} /> CANCEL
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="btn-primary py-2.5 px-6 text-xs font-black shadow-lg shadow-indigo-500/20 disabled:opacity-60"
                                    >
                                        <Save size={14} strokeWidth={3} className="mr-1" /> {saving ? 'SAVING...' : 'SAVE CHANGES'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {saveMsg && (
                            <div className={`mb-8 p-4 rounded-2xl text-xs font-black uppercase tracking-widest ${saveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                {saveMsg.text}
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-6">
                            <Field
                                label="First Name"
                                icon={User}
                                value={profile?.first_name}
                                editContent={
                                    <input className={inputClass} value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
                                }
                            />
                            <Field
                                label="Last Name"
                                icon={User}
                                value={profile?.last_name}
                                editContent={
                                    <input className={inputClass} value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
                                }
                            />
                            <Field
                                label="Date of Birth"
                                icon={User}
                                value={profile ? formatDOB(profile.dob) : null}
                            />
                            <div className="md:col-span-2">
                                <Field
                                    label="Email Address"
                                    icon={Mail}
                                    value={user?.email}
                                />
                            </div>
                            <Field
                                label="Phone Number"
                                icon={Phone}
                                value={profile?.phone}
                                editContent={
                                    <input className={inputClass} type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                                }
                            />
                            <Field
                                label="Blood Group"
                                value={profile?.blood_group}
                                editContent={
                                    <select className={inputClass} value={form.blood_group} onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))}>
                                        <option value="">Select</option>
                                        {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                    </select>
                                }
                            />
                            <div className="md:col-span-2">
                                <Field
                                    label="Address"
                                    icon={MapPin}
                                    value={profile?.address}
                                    editContent={
                                        <input className={inputClass} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    {/* Latest Follow-up Recommendation Block */}
                    {latestFollowup && (
                        <div className="bg-emerald-600 rounded-[2.5rem] shadow-2xl shadow-emerald-200 p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                            <div className="relative flex items-center gap-4 mb-8">
                                <div className="p-3 bg-white/20 rounded-2xl text-white backdrop-blur-md">
                                    <CalendarIcon size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">Clinical Follow-up</h3>
                                    <p className="text-emerald-100 text-[11px] font-bold uppercase tracking-widest mt-1">Recommended by your physician</p>
                                </div>
                            </div>
                            
                            <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-8 border border-white/20 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-white rounded-[1.25rem] flex items-center justify-center text-emerald-600 font-black text-2xl shadow-xl shadow-emerald-900/20">
                                        {new Date(latestFollowup.follow_up_date).getDate()}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1 opacity-70">Tentative Window</p>
                                        <p className="text-lg font-black text-white tracking-tight">
                                            {new Date(latestFollowup.follow_up_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden md:block h-12 w-px bg-white/20"></div>
                                <div className="text-center md:text-left">
                                    <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-1 opacity-70">Attending Specialist</p>
                                    <p className="text-lg font-black text-white tracking-tight">Dr. {latestFollowup.doc_first} {latestFollowup.doc_last}</p>
                                    <p className="text-xs text-emerald-200 font-bold italic">{latestFollowup.specialty}</p>
                                </div>
                                <button 
                                    onClick={() => window.location.href = '/book'}
                                    className="px-8 py-4 bg-white text-emerald-600 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl hover:scale-105 active:scale-95"
                                >
                                    Book Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Recent Medical Records Summary */}
                    {pastVisits.length > 0 && (
                        <div id="medical-history" className="glass-card rounded-[2.5rem] p-10">
                            <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-4 tracking-tight uppercase tracking-widest">
                                <Activity size={24} className="text-indigo-600" strokeWidth={2.5} /> Clinical Records
                            </h3>
                            <div className="space-y-6">
                                {pastVisits.slice(0, 3).map(visit => (
                                    <div key={visit.id} className="group p-6 bg-slate-50/50 hover:bg-white rounded-3xl border border-slate-100 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-6">
                                                <div className="p-4 bg-white rounded-2xl shadow-sm text-slate-300 group-hover:text-indigo-600 transition-colors">
                                                    <FileText size={24} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 tracking-tight text-lg">Dr. {visit.doc_first} {visit.doc_last}</h4>
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{visit.specialty} • {new Date(visit.appointment_date).toLocaleDateString()}</p>
                                                    {(visit.diagnosis || visit.prescription) && (
                                                        <div className="mt-4 flex gap-2">
                                                            {visit.diagnosis && <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Diagnosis</span>}
                                                            {visit.prescription && <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Rx Active</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setActiveVisit(visit)}
                                                className="px-6 py-3 bg-white text-indigo-600 text-[11px] font-black uppercase tracking-widest rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                            >
                                                Analyze Report
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => navigate('/patient-dashboard')}
                                    className="w-full py-5 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-indigo-600 rounded-2xl transition-all border-t border-slate-50 mt-4"
                                >
                                    View Full Archive
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <PrescriptionModal visit={activeVisit} onClose={() => setActiveVisit(null)} />
        </div>
    );
};

export default PatientProfile;
