import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Shield, CreditCard, Bell, Settings, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';
import { Pill, Activity, Calendar as CalendarIcon, ChevronRight, FileText, Download, Printer } from 'lucide-react';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white";

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
    const { user, login } = useAuth();
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
        <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">{label}</label>
            {isEditing && editContent ? editContent : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-gray-700 border border-gray-100">
                    {Icon && <Icon size={18} className="text-gray-400 flex-shrink-0" />}
                    <span>{value || '—'}</span>
                </div>
            )}
        </div>
    );

    const PrescriptionModal = ({ visit, onClose }) => {
        if (!visit) return null;
        const date = new Date(visit.appointment_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                    {/* Retro Letterhead Header */}
                    <div className="p-8 bg-gradient-to-r from-primary to-blue-700 text-white relative">
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-lg">
                                <Activity size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">HS MEDICAL CENTER</h2>
                                <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Digital Prescription & Consultation Report</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-y-2 gap-x-6 text-sm text-white/90 font-medium">
                            <span className="flex items-center gap-1.5"><CalendarIcon size={14} /> {date}</span>
                            <span className="flex items-center gap-1.5"><User size={14} /> Dr. {visit.doc_first} {visit.doc_last} ({visit.specialty})</span>
                        </div>
                    </div>

                    <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-[url('https://www.transparenttextures.com/patterns/notebook.png')]">
                        <section className="space-y-3">
                            <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Diagnosis & Observations
                            </h4>
                            <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 italic text-gray-800 leading-relaxed shadow-sm">
                                {visit.diagnosis || 'No specific diagnosis recorded.'}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Medication & Rx
                            </h4>
                            <div className="p-6 bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-inner">
                                <div className="whitespace-pre-wrap font-mono text-sm text-gray-700 leading-relaxed">
                                    {visit.prescription || 'No medications prescribed.'}
                                </div>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div> Clinical Notes
                            </h4>
                            <p className="text-gray-600 text-sm leading-relaxed px-1">
                                {visit.notes || 'Routine follow-up advised.'}
                            </p>
                        </section>

                        <div className="pt-8 border-t border-gray-100 flex justify-between items-end">
                            <div className="flex-1 space-y-6">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Digitally Signed By</p>
                                <p className="font-serif italic text-xl text-gray-800">Dr. {visit.doc_first} {visit.doc_last}</p>
                                <p className="text-xs text-primary font-bold">{visit.specialty}</p>
                            </div>
                            <div className="flex gap-3">
                                <button className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors">
                                    <Printer size={18} />
                                </button>
                                <button className="px-5 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all">
                                    <Download size={16} /> Download PDF
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
                    <div id="personal-info" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
                            {!isEditing ? (
                                <button
                                    onClick={startEdit}
                                    className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary-light transition-colors"
                                >
                                    Edit Profile
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1">
                                        <X size={14} /> Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors flex items-center gap-1 disabled:opacity-60"
                                    >
                                        <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {saveMsg && (
                            <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${saveMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-sm border border-amber-100 p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
                                    <CalendarIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Follow-up Recommendation</h3>
                                    <p className="text-sm text-amber-700">Recommended by your doctor based on your last visit.</p>
                                </div>
                            </div>
                            
                            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-white flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 font-bold text-lg border border-amber-100">
                                        {new Date(latestFollowup.follow_up_date).getDate()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Scheduled For Around</p>
                                        <p className="text-lg font-bold text-gray-900">
                                            {new Date(latestFollowup.follow_up_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden md:block h-10 w-px bg-gray-200"></div>
                                <div className="text-center md:text-left">
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">With Specialist</p>
                                    <p className="text-lg font-bold text-gray-900">Dr. {latestFollowup.doc_first} {latestFollowup.doc_last}</p>
                                    <p className="text-xs text-primary font-semibold">{latestFollowup.specialty}</p>
                                </div>
                                <button 
                                    onClick={() => window.location.href = '/book'}
                                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                                >
                                    Book Follow-up
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Recent Medical Records Summary */}
                    {pastVisits.length > 0 && (
                        <div id="medical-history" className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Activity size={20} className="text-primary" /> Recent Medical Records
                            </h3>
                            <div className="space-y-4">
                                {pastVisits.slice(0, 3).map(visit => (
                                    <div key={visit.id} className="group p-5 bg-gray-50 hover:bg-blue-50/50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all">
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-4">
                                                <div className="p-3 bg-white rounded-xl shadow-sm text-gray-400 group-hover:text-primary transition-colors">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">Dr. {visit.doc_first} {visit.doc_last}</h4>
                                                    <p className="text-xs text-gray-500">{visit.specialty} • {new Date(visit.appointment_date).toLocaleDateString()}</p>
                                                    {(visit.diagnosis || visit.prescription) && (
                                                        <div className="mt-3 flex gap-2">
                                                            {visit.diagnosis && <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-[10px] font-bold uppercase">Diagnosis</span>}
                                                            {visit.prescription && <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-[10px] font-bold uppercase">Prescription</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setActiveVisit(visit)}
                                                className="px-4 py-2 bg-white text-primary text-xs font-bold rounded-xl border border-primary/20 shadow-sm hover:bg-primary hover:text-white transition-all"
                                            >
                                                View Report
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => navigate('/patient-dashboard')}
                                    className="w-full py-4 text-center text-sm font-bold text-primary hover:bg-primary-light rounded-2xl transition-all"
                                >
                                    View Full Medical History
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
