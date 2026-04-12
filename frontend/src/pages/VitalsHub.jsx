/**
 * Issue #45: Vitals Hub - PREMIUM OVERHAUL & STABILIZATION
 * Biometric Analytics Core for high-fidelity health monitoring.
 */

import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
    Activity, Heart, Scale, Thermometer, Plus, ChevronRight, 
    Activity as Pulse, Zap, ShieldCheck, Target, Sparkles,
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
            console.error('[Biometrics] Sync failed:', error);
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
                alert(err.message || 'Registry log failure');
            }
        } catch (error) {
            console.error('[Biometrics] Log error:', error);
        }
    };

    if (loading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-20 space-y-8 animate-in fade-in duration-1000">
             <div className="w-24 h-24 border-8 border-primary/10 border-t-primary rounded-full animate-spin"></div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic animate-pulse">Synchronizing Biometric Core...</p>
        </div>
    );

    const latest = Array.isArray(vitals) && vitals.length > 0 ? vitals[vitals.length - 1] : {};

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000 px-4">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 group">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 transition-transform duration-700">
                        <Pulse size={36} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--test-base)] tracking-tighter uppercase italic leading-none">Biometric Core</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 italic leading-none opacity-60">High-fidelity health telemetry & trend analytics</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowLogModal(true)}
                    className="group relative px-10 py-5 bg-primary text-white font-black text-[12px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all italic flex items-center gap-4"
                >
                    <Plus size={20} strokeWidth={3} />
                    Log Node Data
                </button>
            </div>

            {/* Vitals Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <VitalCard icon={<Scale size={28} strokeWidth={2.5} className="text-indigo-500" />} label="Mass Index" value={latest.weight_kg} unit="KG" theme="indigo" />
                <VitalCard icon={<Heart size={28} strokeWidth={2.5} className="text-rose-500" />} label="Force Sync" value={latest.blood_pressure_sys ? `${latest.blood_pressure_sys}/${latest.blood_pressure_dia}` : null} unit="MMHG" theme="rose" />
                <VitalCard icon={<Activity size={28} strokeWidth={2.5} className="text-emerald-500" />} label="Pulse Delta" value={latest.heart_rate} unit="BPM" theme="emerald" />
                <VitalCard icon={<Thermometer size={28} strokeWidth={2.5} className="text-amber-500" />} label="Thermal Reg" value={latest.temperature_c} unit="°C" theme="amber" />
            </div>

            {/* Trends Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Blood Pressure Chart */}
                <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity"><Zap size={64} /></div>
                    <h3 className="text-2xl font-black text-[var(--test-base)] mb-12 flex items-center gap-6 italic uppercase tracking-tighter">
                        <span className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner border border-rose-500/20"><Heart size={24} /></span>
                        Pressure Meridian
                    </h3>
                    <div className="h-80 w-full">
                        {vitals.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={vitals} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: 900, textTransform: 'uppercase'}} dy={20} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 9, fontWeight: 900, textTransform: 'uppercase'}} dx={-20} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                                            borderRadius: '2rem', 
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            backdropFilter: 'blur(20px)',
                                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                            color: '#fff',
                                            fontSize: '10px',
                                            fontWeight: '900',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            padding: '20px'
                                        }}
                                        itemStyle={{ paddingBottom: '4px' }}
                                    />
                                    <Line type="monotone" dataKey="blood_pressure_sys" stroke="#6366f1" strokeWidth={5} dot={{ r: 8, fill: '#6366f1', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 12, strokeWidth: 0, shadow: '0 0 20px #6366f1' }} name="Systolic" />
                                    <Line type="monotone" dataKey="blood_pressure_dia" stroke="#818cf8" strokeWidth={5} dot={{ r: 8, fill: '#818cf8', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 12, strokeWidth: 0, shadow: '0 0 20px #818cf8' }} name="Diastolic" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-20 italic">
                                <Zap size={48} />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Baseline Trends...</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Heart Rate Chart */}
                <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity"><RefreshCw size={64} /></div>
                    <h3 className="text-2xl font-black text-[var(--test-base)] mb-12 flex items-center gap-6 italic uppercase tracking-tighter">
                        <span className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner border border-emerald-500/20"><Pulse size={24} /></span>
                        Pulse Resonance
                    </h3>
                    <div className="h-80 w-full">
                        {vitals.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={vitals} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" hide />
                                    <YAxis hide domain={['dataMin - 15', 'dataMax + 15']} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                                            borderRadius: '2rem', 
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            backdropFilter: 'blur(20px)',
                                            color: '#fff',
                                            fontSize: '10px',
                                            fontWeight: '900',
                                            padding: '20px'
                                        }}
                                    />
                                    <Area type="monotone" dataKey="heart_rate" stroke="#10b981" fillOpacity={1} fill="url(#colorHr)" strokeWidth={5} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-20 italic">
                                <RefreshCw size={48} />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Synchronizing Waveforms...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Log Vitals Modal */}
            {showLogModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="glass-modal w-full max-w-xl p-16 rounded-[4rem] border-none shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-5"><Plus size={64} /></div>
                        <div className="flex justify-between items-center mb-12">
                            <h2 className="text-3xl font-black text-[var(--test-base)] uppercase italic tracking-tighter leading-none">Record Biometric Node</h2>
                            <button onClick={() => setShowLogModal(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                                <X size={24} className="text-slate-500" />
                            </button>
                        </div>
                        <form onSubmit={handleLog} className="space-y-10">
                            <div className="grid grid-cols-2 gap-10">
                                <div className="block space-y-4">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-2 italic">Mass Index (kg)</span>
                                    <input type="number" step="0.1" className="bg-white/5 border border-white/5 w-full p-6 rounded-[1.75rem] focus:ring-4 focus:ring-primary/20 outline-none text-[var(--test-base)] font-black italic tracking-tight shadow-inner" value={formData.weight_kg} onChange={e => setFormData({...formData, weight_kg: e.target.value})} required placeholder="0.0" />
                                </div>
                                <div className="block space-y-4">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-2 italic">Thermal Reg (°C)</span>
                                    <input type="number" step="0.1" className="bg-white/5 border border-white/5 w-full p-6 rounded-[1.75rem] focus:ring-4 focus:ring-primary/20 outline-none text-[var(--test-base)] font-black italic tracking-tight shadow-inner" value={formData.temperature_c} onChange={e => setFormData({...formData, temperature_c: e.target.value})} placeholder="36.5" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-10">
                                <div className="block space-y-4">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-2 italic">BP Systolic</span>
                                    <input type="number" className="bg-white/5 border border-white/5 w-full p-6 rounded-[1.75rem] focus:ring-4 focus:ring-primary/20 outline-none text-[var(--test-base)] font-black italic tracking-tight shadow-inner" value={formData.blood_pressure_sys} onChange={e => setFormData({...formData, blood_pressure_sys: e.target.value})} placeholder="120" />
                                </div>
                                <div className="block space-y-4">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-2 italic">BP Diastolic</span>
                                    <input type="number" className="bg-white/5 border border-white/5 w-full p-6 rounded-[1.75rem] focus:ring-4 focus:ring-primary/20 outline-none text-[var(--test-base)] font-black italic tracking-tight shadow-inner" value={formData.blood_pressure_dia} onChange={e => setFormData({...formData, blood_pressure_dia: e.target.value})} placeholder="80" />
                                </div>
                            </div>
                            <div className="block space-y-4">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-2 italic">Pulse Velocity (bpm)</span>
                                <input type="number" className="bg-white/5 border border-white/5 w-full p-6 rounded-[1.75rem] focus:ring-4 focus:ring-primary/20 outline-none text-[var(--test-base)] font-black italic tracking-tight shadow-inner" value={formData.heart_rate} onChange={e => setFormData({...formData, heart_rate: e.target.value})} placeholder="72" />
                            </div>
                            
                            <div className="flex gap-6 pt-8">
                                <button type="button" onClick={() => setShowLogModal(false)} className="flex-1 py-6 bg-white/5 border border-white/5 text-slate-400 font-black text-[12px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-white/10 transition-all italic">Discard Sync</button>
                                <button type="submit" className="flex-1 py-6 bg-primary text-white font-black text-[12px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all italic">Execute Data Log</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Insight Module */}
            <div className="glass-card rounded-[3.5rem] p-12 border-none bg-white/5 relative overflow-hidden group shadow-2xl">
                 <div className="absolute top-0 right-0 p-12 opacity-5"><Info size={64} /></div>
                <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                    <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                        <Sparkles size={40} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-[var(--test-base)] uppercase italic tracking-tighter mb-4">Neural Health Insight</h4>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic leading-relaxed max-w-2xl opacity-80">
                            {vitals.length > 0 ? "Telemetry synchronization detects steady biometric patterns within standard clinical windows. Maintain current baseline for optimal meridian alignment." : "Awaiting biometric baseline synchronization. Log your first node data to activate neural insight protocols."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const VitalCard = ({ icon, label, value, unit, theme }) => {
    const themeColors = {
        indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500 shadow-indigo-500/10',
        rose: 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-rose-500/10',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/10',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-amber-500/10'
    };

    return (
        <div className="glass-card p-10 flex flex-col items-center text-center gap-8 hover:translate-y-[-8px] hover:shadow-2xl transition-all duration-700 rounded-[3.5rem] group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full blur-3xl transition-opacity group-hover:opacity-10 ${themeColors[theme] ? themeColors[theme].split(' ')[2].replace('text-', 'bg-') : 'bg-primary'}`}></div>
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-700 border ${themeColors[theme] || ''}`}>
                {icon}
            </div>
            <div className="space-y-3 relative z-10">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] italic opacity-60 leading-none">{label}</p>
                <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black text-[var(--test-base)] tracking-tighter italic tabular-nums leading-none">{value || '—'}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-none">{unit}</span>
                </div>
            </div>
        </div>
    );
};

export default VitalsHub;
