import React, { useState, useEffect } from 'react';
import { 
    Bell, BellOff, Clock, Mail, MessageSquare, Smartphone, Save, 
    CheckCircle2, Sparkles, ShieldCheck, Zap, Info, Radio,
    Volume2, VolumeX, Moon, Sun, Target, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

const NotificationSettings = () => {
    const [preferences, setPreferences] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            const data = await apiClient.get('/api/notifications/preferences');
            if (data && !data.error) setPreferences(data);
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    const handleToggle = (field) => {
        setPreferences(prev => ({ ...prev, [field]: !prev[field] }));
        setSaved(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data = await apiClient.put('/api/notifications/preferences', preferences);
            if (data && !data.error) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
        } catch (err) { console.error(err); } finally { setIsSaving(false); }
    };

    if (isLoading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse ">Synchronizing Comms Control...</div>;

    if (!preferences) return <div className="p-20 text-center text-rose-500 font-black uppercase tracking-[0.2em] ">Comms Link Severed</div>;

    const Toggle = ({ enabled, onToggle, disabled = false }) => (
        <button
            onClick={onToggle}
            disabled={disabled}
            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-700 ${
                enabled ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-white/5 border border-white/5 shadow-inner'
            } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
        >
            <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-700 shadow-md ${
                    enabled ? 'translate-x-9' : 'translate-x-2'
                }`}
            />
        </button>
    );

    const Section = ({ title, description, icon: Icon, children }) => (
        <div className="glass-modal p-10 rounded-[3.5rem] border-none shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity"><Icon size={64} /></div>
            <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter mb-4 flex items-center gap-5">
                <span className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner border border-primary/20"><Icon size={24} /></span>
                {title}
            </h3>
            {description && <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10 opacity-60 ml-16">{description}</p>}
            <div className="space-y-6 ml-16">{children}</div>
        </div>
    );

    const SettingRow = ({ icon: Icon, label, description, field, disabled }) => (
        <div className="flex items-center justify-between py-4 group/row">
            <div className="flex items-center gap-6">
                <div className={`p-4 bg-white/5 border border-white/5 rounded-2xl transition-all duration-700 group-hover/row:bg-primary/10 group-hover/row:border-primary/20 text-slate-500 group-hover/row:text-primary shadow-inner group-hover/row:rotate-12`}>
                    <Icon size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <p className="text-sm font-black text-[var(--text-base)] uppercase tracking-tighter transition-colors group-hover/row:text-primary">{label}</p>
                    {description && <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1 opacity-60 leading-none">{description}</p>}
                </div>
            </div>
            <Toggle 
                enabled={preferences[field]} 
                onToggle={() => handleToggle(field)}
                disabled={disabled}
            />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000 px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 group">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 transition-transform duration-700">
                        <Radio size={36} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none">Comms Center</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 leading-none opacity-60">High-fidelity clinical synchronicity hub</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-4 px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] transition-all shadow-2xl ${
                        saved 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-primary text-white hover:shadow-primary/40 hover:-translate-y-1'
                    } disabled:opacity-50 group/btn`}
                >
                    {saved ? (
                        <>
                            <CheckCircle2 size={20} />
                            Registry Synced
                        </>
                    ) : (
                        <>
                            <Save size={20} className="group-hover/btn:scale-110 transition-transform" />
                            {isSaving ? 'Syncing...' : 'Execute Baseline'}
                        </>
                    )}
                </button>
            </div>

            <Section title="Neural Channels" description="Primary broadcast vectors for node updates" icon={Zap}>
                <SettingRow icon={Smartphone} label="Push Overlay" description="Unit-level hardware notifications" field="push_enabled" />
                <SettingRow icon={MessageSquare} label="SMS Frequency" description="Alpha-numeric direct link" field="sms_enabled" />
                <SettingRow icon={Mail} label="Nexus Email" description="Clinical log records & protocols" field="email_enabled" />
            </Section>

            <Section title="Broadcast Matrix" description="Signal selection for specific event cycles" icon={Target}>
                <SettingRow icon={Bell} label="Sync Index" description="Queue position & recalibrations" field="queue_updates" />
                <SettingRow icon={Clock} label="Temporal Alerts" description="Pre-cycle event reminders" field="appointment_reminders" />
                <SettingRow icon={BellOff} label="Lag Detection" description="Clinical throughput delay warnings" field="delay_alerts" />
                <SettingRow icon={Sparkles} label="Waitlist Flux" description="Dynamic slot availability nodes" field="waitlist_offers" />
            </Section>

            <Section title="Temporal Reminders" description="Lead-time lead lead-time cycles" icon={Clock}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <ReminderNode label="24H ALPHA" field="reminder_24h" enabled={preferences.reminder_24h} onToggle={() => handleToggle('reminder_24h')} />
                    <ReminderNode label="1H BETA" field="reminder_1h" enabled={preferences.reminder_1h} onToggle={() => handleToggle('reminder_1h')} />
                    <ReminderNode label="30M GAMMA" field="reminder_30m" enabled={preferences.reminder_30m} onToggle={() => handleToggle('reminder_30m')} />
                </div>
            </Section>

            <Section title="Sleep Cycle" description="Silence non-critical pulse during downtime" icon={Moon}>
                 <div className="flex items-center justify-between mb-10 p-6 bg-white/5 border border-white/5 rounded-3xl shadow-inner group/quiet">
                    <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl border transition-all duration-700 ${preferences.quiet_hours_enabled ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500 rotate-12' : 'bg-white/5 border-white/5 text-slate-500'}`}>
                            {preferences.quiet_hours_enabled ? <VolumeX size={24} /> : <Volume2 size={24} />}
                        </div>
                        <div>
                            <p className="text-sm font-black text-[var(--text-base)] uppercase tracking-tighter">Initiate Quiet Mode</p>
                            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1 opacity-60">Suspend auxiliary broadcasts</p>
                        </div>
                    </div>
                    <Toggle enabled={preferences.quiet_hours_enabled} onToggle={() => handleToggle('quiet_hours_enabled')} />
                </div>
                
                {preferences.quiet_hours_enabled && (
                    <div className="grid grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-700 max-w-sm mx-auto">
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] pl-4 ">Baseline Start</label>
                            <div className="relative group/time">
                                <Sun className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-hover/time:text-primary transition-colors" size={16} />
                                <input
                                    type="time"
                                    value={preferences.quiet_start?.slice(0, 5) || '22:00'}
                                    onChange={e => setPreferences(prev => ({ ...prev, quiet_start: e.target.value + ':00' }))}
                                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] pl-4 ">Nominal Resume</label>
                            <div className="relative group/time">
                                <Sun className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-hover/time:text-primary transition-colors" size={16} />
                                <input
                                    type="time"
                                    value={preferences.quiet_end?.slice(0, 5) || '08:00'}
                                    onChange={e => setPreferences(prev => ({ ...prev, quiet_end: e.target.value + ':00' }))}
                                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all font-mono"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </Section>

            <div className="glass-card rounded-[3.5rem] p-12 border-none bg-white/5 relative overflow-hidden group shadow-2xl">
                 <div className="absolute top-0 right-0 p-12 opacity-5"><Info size={64} /></div>
                <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                    <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                        <ShieldCheck size={40} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-[var(--text-base)] uppercase tracking-tighter mb-4">Comms Security Protocol</h4>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-relaxed max-w-2xl opacity-80">
                            Broadcast signals are strictly end-to-end encrypted. Node preferences are stored in isolated clinical registry segments with 256-bit AES protection.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ReminderNode = ({ label, enabled, onToggle }) => (
    <button
        onClick={onToggle}
        className={`p-6 rounded-[2rem] border transition-all duration-700 text-center relative overflow-hidden group shadow-sm ${
            enabled ? 'bg-primary border-primary shadow-primary/20 scale-[1.02]' : 'bg-white/5 border-white/5 hover:bg-white/10'
        }`}
    >
        <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-3 transition-colors ${enabled ? 'text-white' : 'text-slate-500'}`}>{label}</p>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto transition-all duration-700 ${enabled ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-700 group-hover:rotate-12'}`}>
            <Clock size={20} strokeWidth={3} />
        </div>
        {enabled && <div className="absolute top-2 right-2 text-white/50"><CheckCircle2 size={12} /></div>}
    </button>
);

export default NotificationSettings;
