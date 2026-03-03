import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Shield, CreditCard, Bell, Settings, Save, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

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

    useEffect(() => {
        if (!user?.id) return;
        fetch(`${API}/api/patients/${user.id}`)
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
                </div>
            </div>
        </div>
    );
};

export default PatientProfile;
