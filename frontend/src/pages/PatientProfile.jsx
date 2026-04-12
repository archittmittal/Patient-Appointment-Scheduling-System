/**
 * Patient Profile - PREMIUM OVERHAUL
 * High-fidelity clinical security and biometric management.
 */

import React, { useState, useEffect } from 'react';
import { 
    User, Phone, Mail, MapPin, Shield, CreditCard, 
    Bell, Settings, Save, X, Lock, Pill, Activity, 
    Calendar as CalendarIcon, ChevronRight, FileText, 
    Download, Printer, Sparkles, ShieldCheck, Fingerprint
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API } from '../config/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const inputClass = "w-full glass-card border-[var(--border-base)] rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 bg-white/5 font-bold text-[var(--text-base)] transition-all placeholder:text-slate-600 uppercase tracking-wider italic";

const ProfileMenu = ({ icon: Icon, title, description, isActive, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-5 p-6 rounded-[2.5rem] transition-all duration-700 group relative overflow-hidden ${isActive
            ? 'bg-primary text-white shadow-2xl shadow-primary/20 -translate-y-1'
            : 'glass-card border-[var(--border-base)] text-slate-500 hover:border-primary/20 hover:bg-white/5'
        }`}>
        {isActive && <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>}
        <div className={`p-3.5 rounded-2xl transition-all duration-700 ${isActive ? 'bg-white/20' : 'bg-white/5 text-slate-400 group-hover:text-primary group-hover:bg-primary/10 shadow-inner'}`}>
            <Icon size={20} strokeWidth={2.5} />
        </div>
        <div className="text-left flex-1 relative z-10">
            <h4 className={`font-black text-sm tracking-tight uppercase italic ${isActive ? 'text-white' : 'text-[var(--text-base)]'}`}>{title}</h4>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1.5 italic ${isActive ? 'text-white/80' : 'text-slate-500'}`}>{description}</p>
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
    const [saveMsg, setSaveMsg] = useState(null);
    const [pastVisits, setPastVisits] = useState([]);
    const [latestFollowup, setLatestFollowup] = useState(null);
    const [activeVisit, setActiveVisit] = useState(null);

    useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const [pRes, vRes] = await Promise.all([
                    fetch(`${API}/api/patients/${user.id}`),
                    fetch(`${API}/api/patients/${user.id}/appointments?type=past`)
                ]);
                const pData = await pRes.json();
                const vData = await vRes.json();
                
                setProfile(pData);
                const visits = Array.isArray(vData) ? vData : [];
                setPastVisits(visits);
                
                const withFollowup = visits
                    .filter(a => a.follow_up_date && new Date(a.follow_up_date) >= new Date())
                    .sort((a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date));
                setLatestFollowup(withFollowup[0] || null);
            } catch (err) { console.error(err); }
        };
        fetchData();
    }, [user?.id]);

    const fullName = profile
        ? `${profile.first_name} ${profile.last_name}`
        : `${user?.first_name || ''} ${user?.last_name || ''}`.trim();

    const formatDOB = (dob) => {
        if (!dob) return '—';
        const d = new Date(dob);
        const age = new Date().getFullYear() - d.getFullYear();
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • ${age} Yrs Cycled`;
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

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/patients/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setProfile(updated);
            login({ ...user, first_name: updated.first_name, last_name: updated.last_name });
            setIsEditing(false);
            setSaveMsg({ type: 'success', text: 'Telemetry Updated' });
            setTimeout(() => setSaveMsg(null), 3000);
        } catch {
            setSaveMsg({ type: 'error', text: 'Update Failed' });
        } finally { setSaving(false); }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-3 px-1">
                        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20"><ShieldCheck size={16} /></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none">Identity Core : Secure</span>
                    </div>
                    <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none">Registry Interface</h1>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
                {/* Identity Sidebar */}
                <div className="space-y-6">
                    <div className="glass-modal rounded-[3.5rem] p-10 text-center relative overflow-hidden shadow-2xl border-none">
                         <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"></div>
                        <div className="relative">
                            <div className="w-40 h-40 mx-auto rounded-[3rem] border-4 border-white/5 p-1 bg-white/5 mb-8 transform hover:scale-105 transition-transform duration-700 shadow-2xl group">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=1e1b4b&color=fff&size=300&bold=true`} alt="Profile" className="w-full h-full object-cover rounded-[2.8rem] opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <h2 className="text-3xl font-black text-[var(--text-base)] tracking-tighter uppercase italic">{fullName}</h2>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-4 flex items-center justify-center gap-2 italic">
                                <Fingerprint size={12} /> ID: #HS-{user?.id?.toString().padStart(4, '0')}
                            </p>
                            <div className="mt-8 pt-8 border-t border-white/5 flex gap-3 justify-center">
                                <Badge label="Verified Station" color="primary" />
                                <Badge label="High Trust" color="emerald" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <ProfileMenu icon={User} title="Biometry Core" description="Registry Metadata" isActive={true} onClick={() => document.getElementById('personal-info')?.scrollIntoView({ behavior: 'smooth' })} />
                        <ProfileMenu icon={Shield} title="Clinical History" description="Record Archive" onClick={() => document.getElementById('medical-history')?.scrollIntoView({ behavior: 'smooth' })} />
                        <ProfileMenu icon={Bell} title="Neural Alerts" description="Sync Protocols" />
                        <ProfileMenu icon={Lock} title="Layer Security" description="Access Encryption" />
                    </div>
                </div>

                {/* Main Configuration Sector */}
                <div className="lg:col-span-2 space-y-10">
                    <div id="personal-info" className="glass-card rounded-[3.5rem] p-10 border-[var(--border-base)] relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={64} /></div>
                        <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8 relative z-10">
                             <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 border border-white/10 shadow-inner group-hover:text-primary transition-all"><Settings size={20} strokeWidth={2.5} /></div>
                                 <h3 className="text-xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none">Calibration Parameters</h3>
                             </div>
                            {!isEditing ? (
                                <button
                                    onClick={startEdit}
                                    className="px-8 py-4 text-[10px] font-black text-primary bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg shadow-primary/5 uppercase tracking-widest italic"
                                >
                                    Modify Registry
                                </button>
                            ) : (
                                <div className="flex gap-4">
                                    <button onClick={() => setIsEditing(false)} className="px-6 py-4 text-[10px] font-black text-slate-500 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest italic">Discard</button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="py-4 px-8 bg-primary text-white text-[10px] font-black rounded-2xl shadow-2xl shadow-primary/20 hover:shadow-primary/40 disabled:opacity-60 transition-all uppercase tracking-widest italic"
                                    >
                                        {saving ? 'Transmitting...' : 'Commit Changes'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {saveMsg && (
                            <div className={`mb-10 p-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] italic animate-in slide-in-from-top-4 duration-500 border ${saveMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                {saveMsg.text}
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-8 relative z-10">
                            <RegistryField label="Given Identity" icon={User} value={profile?.first_name} isEditing={isEditing} editContent={<input className={inputClass} value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />} />
                            <RegistryField label="Family Reference" icon={User} value={profile?.last_name} isEditing={isEditing} editContent={<input className={inputClass} value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />} />
                            <RegistryField label="Temporal Origin" icon={CalendarIcon} value={profile ? formatDOB(profile.dob) : null} />
                            <RegistryField label="Telemetry Channel" icon={Mail} value={user?.email} />
                            <RegistryField label="Comm Link" icon={Phone} value={profile?.phone} isEditing={isEditing} editContent={<input className={inputClass} type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />} />
                            <RegistryField label="Biometry: Blood" icon={Shield} value={profile?.blood_group} isEditing={isEditing} editContent={
                                <select className={inputClass} value={form.blood_group} onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))}>
                                    <option value="">Baseline</option>
                                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                </select>
                            } />
                            <div className="md:col-span-2">
                                <RegistryField label="Spatial Coordinate" icon={MapPin} value={profile?.address} isEditing={isEditing} editContent={<input className={inputClass} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />} />
                            </div>
                        </div>
                    </div>

                    {/* Recommendation Hub */}
                    {latestFollowup && (
                        <div className="bg-primary rounded-[3.5rem] shadow-2xl shadow-primary/20 p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all duration-1000"></div>
                            <div className="relative flex items-center gap-6 mb-10">
                                <div className="p-4 bg-white/10 rounded-[1.75rem] text-white shadow-inner backdrop-blur-md border border-white/20">
                                    <Sparkles size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none mb-2">Cycle Calibration Required</h3>
                                    <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] italic">Longitudinal follow-up protocol active</p>
                                </div>
                            </div>
                            
                            <div className="bg-white/5 backdrop-blur-3xl rounded-[3rem] p-10 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden group/card hover:bg-white/10 transition-all duration-700">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 bg-white text-primary rounded-[2rem] flex items-center justify-center font-black text-3xl shadow-2xl shadow-primary/40 group-hover/card:rotate-12 transition-transform duration-700">
                                        {new Date(latestFollowup.follow_up_date).getDate()}
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.4em] mb-2 italic">Neural Window</p>
                                        <p className="text-xl font-black text-white tracking-tighter uppercase italic">
                                            {new Date(latestFollowup.follow_up_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-center md:text-left border-l border-white/10 pl-10 hidden md:block">
                                    <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.4em] mb-2 italic">Assigned Specialist</p>
                                    <p className="text-xl font-black text-white tracking-tighter uppercase italic">Dr. {latestFollowup.doc_first} {latestFollowup.doc_last}</p>
                                    <p className="text-[10px] text-white/60 font-black uppercase tracking-widest mt-1 italic">{latestFollowup.specialty}</p>
                                </div>
                                <button 
                                    onClick={() => navigate('/book')}
                                    className="px-10 py-5 bg-white text-primary font-black text-[10px] uppercase tracking-[0.4em] rounded-[1.75rem] transition-all shadow-2xl hover:scale-105 active:scale-95 italic shadow-white/10"
                                >
                                    Sync Cycle
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Registry History Section */}
                    {pastVisits.length > 0 && (
                        <div id="medical-history" className="glass-card rounded-[3.5rem] p-10 border-[var(--border-base)] relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity"><FileText size={48} /></div>
                            <h3 className="text-[11px] font-black text-slate-500 mb-12 flex items-center gap-4 uppercase tracking-[0.5em] italic">
                                <Activity size={24} className="text-primary" strokeWidth={3} /> Clinical Dossier Archive
                            </h3>
                            <div className="space-y-6">
                                {pastVisits.slice(0, 3).map(visit => (
                                    <div key={visit.id} className="p-8 bg-white/5 hover:bg-white/10 rounded-[2.5rem] border border-white/5 hover:border-primary/20 transition-all duration-700 relative overflow-hidden group/item">
                                         <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-600 group-hover/item:text-primary transition-all shadow-inner group-hover/item:rotate-6">
                                                    <FileText size={24} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-[var(--text-base)] tracking-tighter text-xl uppercase italic">Dr. {visit.doc_first} {visit.doc_last}</h4>
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2 italic">{visit.specialty} • {new Date(visit.appointment_date).toLocaleDateString()}</p>
                                                    <div className="mt-4 flex gap-3">
                                                        {visit.diagnosis && <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[8px] font-black uppercase tracking-widest border border-primary/20 italic">Validated Diagnosis</span>}
                                                        {visit.prescription && <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-500/20 italic">Neural Rx active</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setActiveVisit(visit)}
                                                className="px-8 py-4 bg-white/5 text-primary text-[9px] font-black uppercase tracking-[0.4em] rounded-[1.25rem] border border-primary/20 hover:bg-primary hover:text-white transition-all active:scale-95 italic group/btn"
                                            >
                                                Analyze Dossier <ChevronRight size={12} className="inline ml-1 group-hover/btn:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button className="w-full py-6 text-center text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] hover:text-primary rounded-3xl transition-all border-t border-white/5 mt-6 italic">Full Registry Stream →</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <PrescriptionModal visit={activeVisit} onClose={() => setActiveVisit(null)} />
        </div>
    );
};

const Badge = ({ label, color }) => (
    <span className={`px-5 py-2 bg-${color}/10 text-${color} rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-${color}/20 shadow-inner italic`}>
        {label}
    </span>
);

const RegistryField = ({ label, icon: Icon, value, isEditing, editContent }) => (
    <div className="space-y-4 animate-in fade-in duration-700">
        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic leading-none px-1 flex items-center gap-2">
            <Icon size={12} className="opacity-40" /> {label}
        </label>
        {isEditing && editContent ? editContent : (
            <div className="flex items-center gap-4 p-5 bg-white/5 rounded-[2rem] text-slate-400 border border-white/5 hover:border-primary/20 hover:bg-white/10 transition-all duration-700 group shadow-inner">
                <span className="text-sm font-black text-[var(--text-base)] uppercase tracking-tight italic tabular-nums">{value || '—'}</span>
            </div>
        )}
    </div>
);

const PrescriptionModal = ({ visit, onClose }) => {
    if (!visit) return null;
    const date = new Date(visit.appointment_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-500">
            <div className="glass-modal rounded-[3.5rem] w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh] border-none shadow-2xl relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 -z-10"></div>
                
                <div className="p-10 border-b border-white/10 relative z-10">
                    <button onClick={onClose} className="absolute top-8 right-8 p-4 text-slate-500 hover:text-white rounded-2xl bg-white/5 hover:bg-white/10 transition-all active:scale-95">
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner animate-pulse">
                            <Activity size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2 italic">Clinical Registry : Node-228</p>
                            <h2 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase italic leading-none">Diagnostic Dossier</h2>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-8 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                        <span className="flex items-center gap-3"><CalendarIcon size={14} className="text-primary opacity-60" /> {date}</span>
                        <span className="flex items-center gap-3"><User size={14} className="text-primary opacity-60" /> Dr. {visit.doc_first} {visit.doc_last}</span>
                    </div>
                </div>

                <div className="p-10 space-y-12 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                    <DossierSection title="Clinical Hypotheses (Diagnosis)" icon={<Shield size={16} />} content={visit.diagnosis} />
                    <DossierSection title="Neural Protocols (Prescription)" icon={<Pill size={16} />} content={visit.prescription} mono={true} />
                    <DossierSection title="Practitioner Observations" icon={<FileText size={16} />} content={visit.notes} />

                    <div className="pt-10 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="text-center md:text-left space-y-3">
                            <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.4em] italic">Telemetry Verification Signature</p>
                            <p className="font-serif italic text-3xl text-[var(--text-base)] tracking-tight">Verified Dr. {visit.doc_first} {visit.doc_last}</p>
                            <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] italic">{visit.specialty}</p>
                        </div>
                        <div className="flex gap-4">
                            <button className="p-5 bg-white/5 text-slate-500 rounded-2xl hover:bg-white/10 hover:text-white transition-all border border-white/5 active:scale-95 shadow-inner">
                                <Printer size={20} />
                            </button>
                            <button className="py-5 px-10 bg-primary text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.75rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all italic flex items-center gap-4">
                                <Download size={20} /> Extract Packet
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DossierSection = ({ title, icon, content, mono }) => (
    <section className="space-y-6 animate-in slide-in-from-left-4 duration-700">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] flex items-center gap-4 italic opacity-80">
            <span className="p-2 bg-white/5 rounded-xl text-primary border border-white/10 shadow-inner">{icon}</span> {title}
        </h4>
        <div className={`p-8 bg-white/5 rounded-[2.5rem] border border-white/5 italic text-[var(--text-base)] leading-relaxed shadow-inner border-l-4 border-l-primary/30 ${mono ? 'font-mono text-xs uppercase tracking-tight' : 'text-sm font-bold'}`}>
            {content || 'Registry empty for this field.'}
        </div>
    </section>
);

export default PatientProfile;
