import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
    Activity, Heart, Scale, Thermometer, Plus, ChevronRight, 
    Zap, ShieldCheck, Target, Sparkles,
    Calendar, Clock, Info, ArrowRight, X, FlaskConical, Pill, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API, authedHeaders } from '../config/api';
import { safeFetch } from '../utils/apiHelper';

const VitalsHub = () => {
    const { user } = useAuth();
    const [vitals, setVitals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showLogModal, setShowLogModal] = useState(false);
    const [formData, setFormData] = useState({
        weight_kg: '',
        blood_pressure_sys: '',
        blood_pressure_dia: '',
        heart_rate: '',
        temperature_c: ''
    });

    const fetchVitals = async () => {
        if (!user?.id) return;
        try {
            const data = await safeFetch(`${API}/api/patients/${user.id}/vitals`, {
                headers: authedHeaders()
            });
            
            if (Array.isArray(data)) {
                const formatted = data.map(v => ({
                    ...v,
                    date: v.recorded_at ? new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'
                }));
                setVitals(formatted);
            }
        } catch (error) {
            console.error('[Vitals] Sync failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVitals();
    }, [user?.id]);

    const handleLog = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/api/patients/${user.id}/vitals`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...authedHeaders()
                },
                body: JSON.stringify(formData)
            });
            
            if (res.ok) {
                setShowLogModal(false);
                fetchVitals();
                setFormData({ weight_kg: '', blood_pressure_sys: '', blood_pressure_dia: '', heart_rate: '', temperature_c: '' });
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to save vitals');
            }
        } catch (error) {
            console.error('[Vitals] Log error:', error);
        }
    };

    if (loading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-20 space-y-4">
             <Activity className="text-primary animate-pulse" size={48} />
             <p className="text-sm font-medium text-slate-500 tracking-wide">Loading your health data...</p>
        </div>
    );

    const latest = Array.isArray(vitals) && vitals.length > 0 ? vitals[vitals.length - 1] : {};

    return (
        <div className="section-container space-y-12 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Vitals & Trends</h1>
                    <p className="text-slate-500">Track your key health metrics and monitor progress over time.</p>
                </div>
                <button 
                    onClick={() => setShowLogModal(true)}
                    className="btn-primary"
                >
                    <Plus size={20} />
                    Log New Vitals
                </button>
            </div>

            {/* Vitals Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <VitalCard 
                    icon={<Scale size={24} className="text-indigo-500" />} 
                    label="Weight" 
                    value={latest.weight_kg} 
                    unit="kg" 
                    color="indigo" 
                />
                <VitalCard 
                    icon={<Heart size={24} className="text-rose-500" />} 
                    label="Blood Pressure" 
                    value={latest.blood_pressure_sys ? `${latest.blood_pressure_sys}/${latest.blood_pressure_dia}` : null} 
                    unit="mmHg" 
                    color="rose" 
                />
                <VitalCard 
                    icon={<Activity size={24} className="text-emerald-500" />} 
                    label="Heart Rate" 
                    value={latest.heart_rate} 
                    unit="bpm" 
                    color="emerald" 
                />
                <VitalCard 
                    icon={<Thermometer size={24} className="text-amber-500" />} 
                    label="Temperature" 
                    value={latest.temperature_c} 
                    unit="°C" 
                    color="amber" 
                />
            </div>

            {/* Trends Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Blood Pressure Chart */}
                <div className="apple-card p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                            <Heart size={20} />
                        </div>
                        <h3 className="text-xl font-bold">Blood Pressure Trends</h3>
                    </div>
                    <div className="h-72 w-full">
                        {vitals.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={vitals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#fff', 
                                            borderRadius: '12px', 
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            padding: '12px'
                                        }}
                                    />
                                    <Line type="monotone" dataKey="blood_pressure_sys" stroke="#0071e3" strokeWidth={3} dot={{ r: 4, fill: '#0071e3', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Systolic" />
                                    <Line type="monotone" dataKey="blood_pressure_dia" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4, fill: '#60a5fa', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Diastolic" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <Activity size={32} className="opacity-20" />
                                <p className="text-sm">No data available for trends</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Heart Rate Chart */}
                <div className="apple-card p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                            <Activity size={20} />
                        </div>
                        <h3 className="text-xl font-bold">Heart Rate</h3>
                    </div>
                    <div className="h-72 w-full">
                        {vitals.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={vitals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" hide />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} domain={['dataMin - 10', 'dataMax + 10']} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: '#fff', 
                                            borderRadius: '12px', 
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            padding: '12px'
                                        }}
                                    />
                                    <Area type="monotone" dataKey="heart_rate" stroke="#10b981" fillOpacity={1} fill="url(#colorHr)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <Activity size={32} className="opacity-20" />
                                <p className="text-sm">No data available for trends</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Log Vitals Modal */}
            {showLogModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="apple-card w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold">Log Your Vitals</h2>
                            <button onClick={() => setShowLogModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleLog} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="form-label">Weight (kg)</label>
                                    <input type="number" step="0.1" className="input-field" value={formData.weight_kg} onChange={e => setFormData({...formData, weight_kg: e.target.value})} required placeholder="70.0" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="form-label">Temperature (°C)</label>
                                    <input type="number" step="0.1" className="input-field" value={formData.temperature_c} onChange={e => setFormData({...formData, temperature_c: e.target.value})} placeholder="36.5" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="form-label">BP Systolic</label>
                                    <input type="number" className="input-field" value={formData.blood_pressure_sys} onChange={e => setFormData({...formData, blood_pressure_sys: e.target.value})} placeholder="120" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="form-label">BP Diastolic</label>
                                    <input type="number" className="input-field" value={formData.blood_pressure_dia} onChange={e => setFormData({...formData, blood_pressure_dia: e.target.value})} placeholder="80" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="form-label">Heart Rate (bpm)</label>
                                <input type="number" className="input-field" value={formData.heart_rate} onChange={e => setFormData({...formData, heart_rate: e.target.value})} placeholder="72" />
                            </div>
                            
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowLogModal(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-full font-medium hover:bg-slate-200 transition-all">Cancel</button>
                                <button type="submit" className="flex-1 btn-primary py-3">Save Vitals</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Health Insight Card */}
            <div className="apple-card p-8 border-none bg-primary-light flex items-center gap-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                    <Sparkles size={24} />
                </div>
                <div>
                    <h4 className="text-lg font-bold mb-1">Health Insight</h4>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                        {vitals.length > 0 ? "Your health metrics are within a healthy range. Consistency is key to long-term wellness. Keep logging your data to see more accurate trends." : "Start logging your vitals to see health insights and personalized trends. This helps your doctors provide better care."}
                    </p>
                </div>
            </div>
        </div>
    );
};

const VitalCard = ({ icon, label, value, unit, color }) => {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600',
        rose: 'bg-rose-50 text-rose-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600'
    };

    return (
        <div className="apple-card p-6 hover:shadow-md transition-all duration-300">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colors[color]}`}>
                {icon}
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight">{value || '—'}</span>
                <span className="text-xs font-medium text-slate-400">{unit}</span>
            </div>
        </div>
    );
};

export default VitalsHub;
