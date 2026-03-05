import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, Mail, MessageSquare, Smartphone, Save, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';

const NotificationSettings = () => {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            const res = await fetch(`${API}/api/notifications/preferences`, {
                headers: authedHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setPreferences(data);
            }
        } catch (err) {
            console.error('Fetch preferences error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = (field) => {
        setPreferences(prev => ({ ...prev, [field]: !prev[field] }));
        setSaved(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`${API}/api/notifications/preferences`, {
                method: 'PUT',
                headers: authedHeaders(true),
                body: JSON.stringify(preferences)
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (err) {
            console.error('Save preferences error:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const subscribeToPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('Push notifications are not supported in this browser');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
            });

            await fetch(`${API}/api/notifications/subscribe-push`, {
                method: 'POST',
                headers: authedHeaders(true),
                body: JSON.stringify({ subscription })
            });

            handleToggle('push_enabled');
        } catch (err) {
            console.error('Push subscription error:', err);
            alert('Failed to enable push notifications');
        }
    };

    if (isLoading) {
        return <div className="p-10 text-center text-gray-500 animate-pulse">Loading settings...</div>;
    }

    if (!preferences) {
        return <div className="p-10 text-center text-red-500">Failed to load notification settings</div>;
    }

    const Toggle = ({ enabled, onToggle, disabled = false }) => (
        <button
            onClick={onToggle}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-primary' : 'bg-gray-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    );

    const Section = ({ title, description, children }) => (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
            {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
            <div className="space-y-4">{children}</div>
        </div>
    );

    const SettingRow = ({ icon: Icon, label, description, field, disabled }) => (
        <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                    <Icon size={18} className="text-gray-600" />
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    {description && <p className="text-xs text-gray-500">{description}</p>}
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
        <div className="max-w-2xl mx-auto space-y-6 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
                    <p className="text-gray-500 mt-1">Control how and when you receive notifications.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                        saved 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-primary text-white hover:bg-primary-hover'
                    } disabled:opacity-50`}
                >
                    {saved ? (
                        <>
                            <CheckCircle2 size={18} />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </>
                    )}
                </button>
            </div>

            {/* Notification Channels */}
            <Section 
                title="Notification Channels" 
                description="Choose how you want to receive notifications"
            >
                <SettingRow 
                    icon={Bell} 
                    label="Push Notifications" 
                    description="Browser/device notifications"
                    field="push_enabled"
                />
                <SettingRow 
                    icon={MessageSquare} 
                    label="SMS Notifications" 
                    description="Text messages to your phone"
                    field="sms_enabled"
                />
                <SettingRow 
                    icon={Mail} 
                    label="Email Notifications" 
                    description="Email alerts and reminders"
                    field="email_enabled"
                />
            </Section>

            {/* Notification Types */}
            <Section 
                title="What to Notify" 
                description="Select which updates you want to receive"
            >
                <SettingRow 
                    icon={Bell} 
                    label="Queue Updates" 
                    description="Position changes and turn approaching alerts"
                    field="queue_updates"
                />
                <SettingRow 
                    icon={Clock} 
                    label="Appointment Reminders" 
                    description="Reminders before your appointments"
                    field="appointment_reminders"
                />
                <SettingRow 
                    icon={BellOff} 
                    label="Delay Alerts" 
                    description="When doctor is running behind schedule"
                    field="delay_alerts"
                />
                <SettingRow 
                    icon={Smartphone} 
                    label="Waitlist Offers" 
                    description="When a slot opens from cancellation"
                    field="waitlist_offers"
                />
            </Section>

            {/* Reminder Timing */}
            <Section 
                title="Reminder Timing" 
                description="When to send appointment reminders"
            >
                <SettingRow 
                    icon={Clock} 
                    label="24 Hours Before" 
                    field="reminder_24h"
                />
                <SettingRow 
                    icon={Clock} 
                    label="1 Hour Before" 
                    field="reminder_1h"
                />
                <SettingRow 
                    icon={Clock} 
                    label="30 Minutes Before" 
                    field="reminder_30m"
                />
            </Section>

            {/* Quiet Hours */}
            <Section 
                title="Quiet Hours" 
                description="Pause non-urgent notifications during certain hours"
            >
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg">
                            <BellOff size={18} className="text-gray-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">Enable Quiet Hours</p>
                            <p className="text-xs text-gray-500">Pause notifications during sleep</p>
                        </div>
                    </div>
                    <Toggle 
                        enabled={preferences.quiet_hours_enabled} 
                        onToggle={() => handleToggle('quiet_hours_enabled')}
                    />
                </div>
                
                {preferences.quiet_hours_enabled && (
                    <div className="flex items-center gap-4 mt-4 pl-12">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">From</label>
                            <input
                                type="time"
                                value={preferences.quiet_start?.slice(0, 5) || '22:00'}
                                onChange={e => setPreferences(prev => ({ ...prev, quiet_start: e.target.value + ':00' }))}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">To</label>
                            <input
                                type="time"
                                value={preferences.quiet_end?.slice(0, 5) || '08:00'}
                                onChange={e => setPreferences(prev => ({ ...prev, quiet_end: e.target.value + ':00' }))}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                )}
            </Section>
        </div>
    );
};

export default NotificationSettings;
