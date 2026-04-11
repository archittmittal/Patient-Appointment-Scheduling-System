import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Activity, Heart, Scale, Thermometer, Plus, ChevronRight, Activity as Pulse } from 'lucide-react';

const VitalsHub = () => {
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

    useEffect(() => {
        fetchVitals();
    }, []);

    const fetchVitals = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const response = await fetch(`/api/patients/${user.id}/vitals`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const data = await response.json();
            // Format dates for chart
            const formatted = data.map(v => ({
                ...v,
                date: new Date(v.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }));
            setVitals(formatted);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching vitals:', error);
        }
    };

    const handleLog = async (e) => {
        e.preventDefault();
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            await fetch(`/api/patients/${user.id}/vitals`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}` 
                },
                body: JSON.stringify(formData)
            });
            setShowLogModal(false);
            fetchVitals();
        } catch (error) {
            console.error('Error logging vitals:', error);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-soft">Loading Health Hub...</div>;

    const latest = vitals[vitals.length - 1] || {};

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-h1 font-bold text-secondary">Health Hub</h1>
                    <p className="text-slate-soft text-h3 mt-1">Track your wellness journey</p>
                </div>
                <button 
                    onClick={() => setShowLogModal(true)}
                    className="btn-primary"
                >
                    <Plus size={20} />
                    Log Vitals
                </button>
            </div>

            {/* Vitals Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <VitalCard icon={<Scale className="text-indigo-500" />} label="Weight" value={latest.weight_kg} unit="kg" />
                <VitalCard icon={<Heart className="text-rose-500" />} label="Blood Pressure" value={`${latest.blood_pressure_sys}/${latest.blood_pressure_dia}`} unit="mmHg" />
                <VitalCard icon={<Pulse className="text-emerald-500" />} label="Heart Rate" value={latest.heart_rate} unit="bpm" />
                <VitalCard icon={<Thermometer className="text-orange-500" />} label="Body Temp" value={latest.temperature_c} unit="°C" />
            </div>

            {/* Trends Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Blood Pressure Chart */}
                <div className="glass-card p-6 min-h-[400px]">
                    <h3 className="text-h3 font-bold mb-6 flex items-center gap-2">
                        <Heart size={20} className="text-rose-500" />
                        Blood Pressure Trend
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={vitals}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                                <Line type="monotone" dataKey="blood_pressure_sys" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} name="Systolic" />
                                <Line type="monotone" dataKey="blood_pressure_dia" stroke="#818cf8" strokeWidth={3} dot={{ r: 4, fill: '#818cf8' }} name="Diastolic" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Heart Rate Chart */}
                <div className="glass-card p-6 min-h-[400px]">
                    <h3 className="text-h3 font-bold mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-500" />
                        Heart Rate (BPM)
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={vitals}>
                                <defs>
                                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" hide />
                                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                                <Tooltip />
                                <Area type="monotone" dataKey="heart_rate" stroke="#10b981" fillOpacity={1} fill="url(#colorHr)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Log Vitals Modal */}
            {showLogModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-modal w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <h2 className="text-h2 font-bold mb-6">Record Vitals</h2>
                        <form onSubmit={handleLog} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block space-y-1">
                                    <span className="text-sm font-medium text-slate-soft">Weight (kg)</span>
                                    <input type="number" step="0.1" className="input-field" value={formData.weight_kg} onChange={e => setFormData({...formData, weight_kg: e.target.value})} required />
                                </label>
                                <label className="block space-y-1">
                                    <span className="text-sm font-medium text-slate-soft">Temp (°C)</span>
                                    <input type="number" step="0.1" className="input-field" value={formData.temperature_c} onChange={e => setFormData({...formData, temperature_c: e.target.value})} />
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block space-y-1">
                                    <span className="text-sm font-medium text-slate-soft">BP Systolic</span>
                                    <input type="number" className="input-field" value={formData.blood_pressure_sys} onChange={e => setFormData({...formData, blood_pressure_sys: e.target.value})} />
                                </label>
                                <label className="block space-y-1">
                                    <span className="text-sm font-medium text-slate-soft">BP Diastolic</span>
                                    <input type="number" className="input-field" value={formData.blood_pressure_dia} onChange={e => setFormData({...formData, blood_pressure_dia: e.target.value})} />
                                </label>
                            </div>
                            <label className="block space-y-1">
                                <span className="text-sm font-medium text-slate-soft">Heart Rate (bpm)</span>
                                <input type="number" className="input-field" value={formData.heart_rate} onChange={e => setFormData({...formData, heart_rate: e.target.value})} />
                            </label>
                            
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowLogModal(false)} className="btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn-primary flex-1">Save Data</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const VitalCard = ({ icon, label, value, unit }) => (
    <div className="glass-card p-6 flex items-start gap-4 hover:translate-y-[-4px] transition-all duration-300">
        <div className="p-3 bg-white/50 rounded-2xl shadow-sm border border-white">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-slate-soft tracking-wide">{label}</p>
            <div className="flex items-baseline gap-1 mt-1">
                <span className="text-h3 font-bold text-secondary">{value || '--'}</span>
                <span className="text-caption font-semibold text-slate-soft">{unit}</span>
            </div>
        </div>
    </div>
);

export default VitalsHub;
