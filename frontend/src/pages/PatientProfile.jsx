import React, { useState, useEffect } from 'react';
import { 
    User, Phone, Mail, MapPin, Shield, CreditCard, 
    Bell, Settings, Save, X, Lock, Pill, Activity, 
    Calendar as CalendarIcon, ChevronRight, FileText, 
    Download, Printer, Sparkles, ShieldCheck, Fingerprint
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API, authedHeaders } from '../config/api';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

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
                const headers = authedHeaders();
                const [pRes, vRes] = await Promise.all([
                    fetch(`${API}/api/patients/${user.id}`, { headers }),
                    fetch(`${API}/api/patients/${user.id}/appointments?type=past`, { headers })
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
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${age} years)`;
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
                headers: authedHeaders(true),
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            setProfile(updated);
            login({ ...user, first_name: updated.first_name, last_name: updated.last_name });
            setIsEditing(false);
            setSaveMsg({ type: 'success', text: 'Profile updated successfully' });
            setTimeout(() => setSaveMsg(null), 3000);
        } catch {
            setSaveMsg({ type: 'error', text: 'Failed to update profile' });
        } finally { setSaving(false); }
    };

    return (
        <div className="section-container space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">My Profile</h1>
                    <p className="text-slate-500">Manage your personal information and health records.</p>
                </div>
                {!isEditing ? (
                    <button onClick={startEdit} className="btn-primary px-8">
                        <Settings size={18} /> Edit Profile
                    </button>
                ) : (
                    <div className="flex gap-3">
                        <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-full font-medium hover:bg-slate-200 transition-all">Cancel</button>
                        <button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="btn-primary px-8"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>

            {saveMsg && (
                <div className={`p-4 rounded-xl text-sm font-medium border ${saveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                    {saveMsg.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="apple-card p-8 text-center">
                        <div className="w-32 h-32 mx-auto rounded-full bg-slate-50 border-4 border-white shadow-sm mb-6 overflow-hidden">
                            <img 
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=e8f2ff&color=0071e3&size=200&bold=true`} 
                                alt="Profile" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">{fullName}</h2>
                        <p className="text-sm text-slate-500 mt-1">Patient ID: #HS-{user?.id?.toString().padStart(4, '0')}</p>
                        
                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded-full border border-emerald-100">Verified</span>
                            <span className="px-3 py-1 bg-primary-light text-primary text-[10px] font-bold uppercase rounded-full border border-primary/10">Active Portal</span>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="apple-card p-6 space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Health Snapshot</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Blood Group</span>
                                <span className="text-sm font-bold text-slate-900">{profile?.blood_group || '—'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Last Visit</span>
                                <span className="text-sm font-bold text-slate-900">{pastVisits[0] ? new Date(pastVisits[0].appointment_date).toLocaleDateString() : '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Information Sections */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Personal Details */}
                    <div className="apple-card p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center text-primary">
                                <User size={20} />
                            </div>
                            <h3 className="text-xl font-bold">Personal Details</h3>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                            <ProfileField label="First Name" value={profile?.first_name} isEditing={isEditing} editContent={<input className="input-field" value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />} />
                            <ProfileField label="Last Name" value={profile?.last_name} isEditing={isEditing} editContent={<input className="input-field" value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />} />
                            <ProfileField label="Date of Birth" value={profile ? formatDOB(profile.dob) : null} />
                            <ProfileField label="Email Address" value={user?.email} />
                            <ProfileField label="Phone Number" value={profile?.phone} isEditing={isEditing} editContent={<input className="input-field" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />} />
                            <ProfileField label="Blood Group" value={profile?.blood_group} isEditing={isEditing} editContent={
                                <select className="input-field" value={form.blood_group} onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))}>
                                    <option value="">Select</option>
                                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                </select>
                            } />
                            <div className="md:col-span-2">
                                <ProfileField label="Residential Address" value={profile?.address} isEditing={isEditing} editContent={<input className="input-field" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />} />
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Follow-up */}
                    {latestFollowup && (
                        <div className="apple-card p-8 bg-primary text-white">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-white/10 rounded-xl">
                                    <CalendarIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Upcoming Follow-up</h3>
                                    <p className="text-white/70 text-sm">You have a scheduled follow-up visit</p>
                                </div>
                            </div>
                            
                            <div className="bg-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-white text-primary rounded-xl flex items-center justify-center font-bold text-2xl">
                                        {new Date(latestFollowup.follow_up_date).getDate()}
                                    </div>
                                    <div>
                                        <p className="text-white/60 text-xs uppercase tracking-wider font-bold mb-0.5">Scheduled for</p>
                                        <p className="text-lg font-bold">
                                            {new Date(latestFollowup.follow_up_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden md:block border-l border-white/10 pl-6 h-12">
                                    <p className="text-white/60 text-xs uppercase tracking-wider font-bold mb-0.5">Specialist</p>
                                    <p className="text-lg font-bold">Dr. {latestFollowup.doc_first} {latestFollowup.doc_last}</p>
                                </div>
                                <button 
                                    onClick={() => navigate('/book')}
                                    className="px-8 py-3 bg-white text-primary font-bold text-sm rounded-xl transition-all shadow-lg hover:bg-slate-50 active:scale-95"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Past Appointments */}
                    {pastVisits.length > 0 && (
                        <div className="apple-card p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500">
                                    <FileText size={20} />
                                </div>
                                <h3 className="text-xl font-bold">Recent Visits</h3>
                            </div>
                            
                            <div className="space-y-4">
                                {pastVisits.slice(0, 3).map(visit => (
                                    <div key={visit.id} className="p-5 border border-slate-50 rounded-2xl hover:bg-slate-50 transition-all flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900">Dr. {visit.doc_first} {visit.doc_last}</h4>
                                                <p className="text-xs text-slate-500">{visit.specialty} • {new Date(visit.appointment_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setActiveVisit(visit)}
                                            className="px-6 py-2 bg-white text-primary text-xs font-bold uppercase tracking-wider rounded-full border border-primary/20 hover:bg-primary hover:text-white transition-all"
                                        >
                                            View Report
                                        </button>
                                    </div>
                                ))}
                                <button className="w-full py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-primary transition-all">View All Visits →</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <ReportModal visit={activeVisit} onClose={() => setActiveVisit(null)} />
        </div>
    );
};

const ProfileField = ({ label, value, isEditing, editContent }) => (
    <div className="space-y-1.5">
        <label className="form-label">{label}</label>
        {isEditing && editContent ? editContent : (
            <div className="px-4 py-3 bg-slate-50/50 rounded-xl text-slate-900 text-sm font-medium border border-transparent">
                {value || '—'}
            </div>
        )}
    </div>
);

const ReportModal = ({ visit, onClose }) => {
    if (!visit) return null;
    const date = new Date(visit.appointment_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="apple-card w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-primary">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 leading-tight">Visit Report</h2>
                            <p className="text-xs text-slate-500 font-medium">Recorded on {date}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-8 space-y-10 overflow-y-auto flex-1">
                    <ReportSection title="Diagnosis" icon={<Shield size={16} />} content={visit.diagnosis} />
                    <ReportSection title="Prescription" icon={<Pill size={16} />} content={visit.prescription} />
                    <ReportSection title="Doctor's Notes" icon={<FileText size={16} />} content={visit.notes} />

                    <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="text-center md:text-left">
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Signed by</p>
                            <p className="text-lg font-bold text-slate-900">Dr. {visit.doc_first} {visit.doc_last}</p>
                            <p className="text-xs text-primary font-bold uppercase tracking-wider">{visit.specialty}</p>
                        </div>
                        <div className="flex gap-3">
                            <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all">
                                <Printer size={20} />
                            </button>
                            <button className="btn-primary px-8">
                                <Download size={20} /> Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReportSection = ({ title, icon, content }) => (
    <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            {icon} {title}
        </h4>
        <div className="p-6 bg-slate-50/50 rounded-2xl text-slate-700 text-sm leading-relaxed border border-slate-100/50">
            {content || 'No details available for this section.'}
        </div>
    </div>
);

export default PatientProfile;
