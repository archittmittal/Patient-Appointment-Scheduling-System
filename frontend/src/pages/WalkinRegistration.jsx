import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    User, Clock, AlertCircle, Activity, Heart, Thermometer, 
    CheckCircle2, ArrowRight, ChevronDown, Stethoscope, AlertTriangle,
    Sparkles, ShieldCheck, Zap, ArrowLeft, Compass, Info, Target,
    Activity as Pulse, Navigation
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

const URGENCY_LEVELS = [
    { value: 'LOW', label: 'Idle Priority', description: 'Minor nodes, delay allowed', theme: 'slate', icon: Target },
    { value: 'NORMAL', label: 'Standard sync', description: 'Nominal clinical throughput', theme: 'blue', icon: Activity },
    { value: 'HIGH', label: 'High Priority', description: 'Accelerated registry path', theme: 'amber', icon: Zap },
    { value: 'URGENT', label: 'Critical Node', description: 'Immediate clinical attention', theme: 'rose', icon: AlertTriangle },
    { value: 'EMERGENCY', label: 'Override', description: 'Life-threatening - immediate lock', theme: 'primary', icon: AlertCircle }
];

const getThemeClasses = (theme) => {
    const map = {
        slate: 'bg-slate-500/10 border-slate-500/20 text-slate-500',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
        rose: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
        primary: 'bg-primary/10 border-primary/20 text-primary'
    };
    return map[theme] || map.blue;
};

const UrgencyCard = ({ level, isSelected, onSelect }) => {
    const theme = getThemeClasses(level.theme);
    const Icon = level.icon;

    return (
        <button
            onClick={() => onSelect(level.value)}
            className={`p-6 rounded-[2rem] border transition-all duration-700 text-left relative overflow-hidden group ${
                isSelected 
                    ? `${theme} scale-[1.02] shadow-2xl` 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
            }`}
        >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl border ${isSelected ? theme : 'bg-white/5 border-white/5 shadow-inner'} group-hover:rotate-12 transition-transform duration-700`}>
                    <Icon size={20} className={isSelected ? '' : 'text-slate-600'} />
                </div>
                <div>
                    <h4 className={`text-sm font-black uppercase tracking-tighter ${isSelected ? '' : 'text-[var(--text-base)]'}`}>{level.label}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-60 leading-tight">{level.description}</p>
                </div>
            </div>
            {isSelected && <div className="absolute top-0 right-0 p-3"><CheckCircle2 size={16} /></div>}
        </button>
    );
};

const VitalSignsSection = ({ vitals, setVitals }) => (
    <div className="glass-modal p-10 rounded-[3rem] border-none shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity"><Pulse size={48} /></div>
        <h4 className="text-xl font-black text-[var(--text-base)] mb-8 flex items-center gap-5 uppercase tracking-tighter">
            <span className="w-12 h-12 bg-rose-500/10 rounded-2xl border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner"><Heart size={20} /></span>
            Biometric Telemetry
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <VitalInput label="Temp (°C)" icon={<Thermometer size={16} />} value={vitals.temperature} onChange={(v) => setVitals({...vitals, temperature: v})} placeholder="36.5" />
            <VitalInput label="Heart Rate (bpm)" icon={<Activity size={16} />} value={vitals.heart_rate} onChange={(v) => setVitals({...vitals, heart_rate: v})} placeholder="72" />
            <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-2 ">Blood Pressure Index</label>
                <div className="flex gap-4">
                    <input type="number" placeholder="SYS" value={vitals.bp_systolic || ''} onChange={(e) => setVitals({ ...vitals, bp_systolic: parseInt(e.target.value) || null })} className="w-1/2 p-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all" />
                    <input type="number" placeholder="DIA" value={vitals.bp_diastolic || ''} onChange={(e) => setVitals({ ...vitals, bp_diastolic: parseInt(e.target.value) || null })} className="w-1/2 p-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all" />
                </div>
            </div>
            <VitalInput label="O2 Saturation (%)" value={vitals.oxygen_saturation} onChange={(v) => setVitals({...vitals, oxygen_saturation: v})} placeholder="98" />
        </div>
    </div>
);

const VitalInput = ({ label, icon, value, onChange, placeholder }) => (
    <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-2 ">{label}</label>
        <div className="relative group/input">
            {icon && <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-primary transition-colors">{icon}</div>}
            <input 
                type="number" 
                placeholder={placeholder}
                value={value || ''}
                onChange={(e) => onChange(parseFloat(e.target.value) || null)}
                className={`w-full ${icon ? 'pl-16' : 'px-6'} py-5 bg-white/5 border border-white/5 rounded-2xl text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all`} 
            />
        </div>
    </div>
);

const WalkinRegistration = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [result, setResult] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [urgency, setUrgency] = useState('NORMAL');
    const [reason, setReason] = useState('');
    const [symptoms, setSymptoms] = useState('');
    const [vitals, setVitals] = useState({});
    const [workloads, setWorkloads] = useState([]);
    const [selectedSpecialty, setSelectedSpecialty] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const docData = await apiClient.get('/api/doctors');
                setDoctors(Array.isArray(docData) ? docData : []);

                const workData = await apiClient.get('/api/analytics/optimizer/workloads');
                if (workData && !workData.error) setWorkloads(workData);
            } catch (err) { console.error('Error loading registration data:', err); }
        };
        loadData();
    }, []);

    const getCongestion = (doctorId) => {
        const work = workloads.find(w => w.doctorId === doctorId);
        if (!work) return { label: 'Optimizing', theme: 'slate', waitMins: 0 };
        
        const waitMins = work.totalWaitMins || work.estimatedTotalMins || 0;
        if (waitMins < 30) return { label: `Low Load - ${waitMins}m wait`, theme: 'emerald', waitMins };
        if (waitMins < 60) return { label: `Medium Load - ${waitMins}m wait`, theme: 'amber', waitMins };
        return { label: `High Traffic - ${waitMins}m wait`, theme: 'rose', waitMins };
    };

    const getRecommendedDoctor = (specialty) => {
        const filteredDocs = doctors.filter(d => d.specialty === specialty);
        if (filteredDocs.length === 0) return null;
        
        let bestDoc = filteredDocs[0];
        let minWait = Infinity;
        
        filteredDocs.forEach(d => {
            const cong = getCongestion(d.id);
            if (cong.waitMins < minWait) {
                minWait = cong.waitMins;
                bestDoc = d;
            }
        });
        
        return bestDoc;
    };

    useEffect(() => {
        if (selectedSpecialty) {
            const recommended = getRecommendedDoctor(selectedSpecialty);
            if (recommended) {
                setSelectedDoctor(recommended);
            }
        } else {
            setSelectedDoctor(null);
        }
    }, [selectedSpecialty, doctors, workloads]);

    const specialties = Array.from(new Set(doctors.map(d => d.specialty).filter(Boolean)));

    const handleSubmit = async () => {
        if (!selectedDoctor || !reason) return alert('Protocol Denied: Selection required');
        setIsLoading(true);
        try {
            const data = await apiClient.post('/api/walkin/register', { doctorId: selectedDoctor.id, urgencyLevel: urgency, reason, symptoms, vitalSigns: Object.keys(vitals).length > 0 ? vitals : null });
            if (data && data.error) throw new Error(data.message || 'Registry Link Severed');
            setResult(data);
            setStep(3);
        } catch (err) { alert(err.message); } finally { setIsLoading(false); }
    };

    if (step === 3 && result) {
        return (
            <div className="max-w-xl mx-auto py-24 text-center animate-in scale-in duration-1000">
                <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-500/30 border border-emerald-400/20 rotate-12 transition-transform animate-bounce-slow">
                    <CheckCircle2 size={48} strokeWidth={2.5} />
                </div>
                <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none mb-6">Units Initialized</h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-12 max-w-sm mx-auto opacity-80 leading-relaxed">{result.message}</p>
                <div className="glass-modal p-12 rounded-[4rem] text-left mb-10 border-none shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5"><Zap size={64} /></div>
                    <div className="grid grid-cols-2 gap-10 mb-10">
                        <div className="p-10 bg-primary rounded-[3rem] text-center shadow-2xl shadow-primary/20 relative overflow-hidden group/pos">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                            <p className="text-7xl font-black text-white tracking-tighter tabular-nums leading-none">#{result.queuePosition}</p>
                            <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.4em] mt-6 ">Queue Index</p>
                        </div>
                        <div className="p-10 bg-white/5 rounded-[3rem] text-center border border-white/5 shadow-inner">
                            <p className="text-7xl font-black text-primary tracking-tighter tabular-nums leading-none">~{result.estimatedWaitMinutes}</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-6 ">Mins Wait</p>
                        </div>
                    </div>
                    <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 flex items-center justify-between opacity-80 ">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Triage Vector</span>
                        <span className="text-lg font-black text-primary tracking-tighter">{result.triageScore} SC</span>
                    </div>
                </div>
                <div className="glass-card p-8 border-amber-500/10 bg-amber-500/5 rounded-3xl mb-10 flex items-start gap-6 text-left relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><AlertCircle size={40} /></div>
                    <AlertCircle className="text-amber-500 flex-shrink-0 mt-1" size={24} />
                    <div>
                        <p className="text-[11px] font-black text-amber-600 uppercase tracking-[0.2em] mb-1">Clinic Protocol Alert</p>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest opacity-80 leading-relaxed ">Synchronizing... Maintain physical presence in alpha-wing waiting clusters. Comms active.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <button onClick={() => navigate('/queue')} className="py-6 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all ">Stream Queue</button>
                    <button onClick={() => navigate('/dashboard')} className="py-6 bg-white/5 border border-white/5 text-slate-500 font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-white/10 transition-all ">Exit Module</button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000 px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 group">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 transition-transform duration-700">
                        <Stethoscope size={36} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none">Entry Portal</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 leading-none opacity-60">High-fidelity clinical walk-in synchronization</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-white/5 border border-white/5 px-8 py-3 rounded-full animate-in slide-in-from-right-10 duration-700">
                    {[1, 2].map((s) => (
                        <div key={s} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] transition-all duration-700 shadow-inner ${step >= s ? 'bg-primary text-white' : 'bg-white/10 text-slate-600'}`}>{s.toString().padStart(2, '0')}</div>
                            {s === 1 && <ArrowRight size={14} className="text-slate-800" />}
                        </div>
                    ))}
                </div>
            </div>

            {step === 1 && (
                <div className="space-y-12 animate-in slide-in-from-right-10 duration-700">
                    <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity"><User size={64} /></div>
                        <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter mb-10 flex items-center gap-5 ">
                            <span className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner border border-primary/20"><Compass size={24} /></span>
                            Clinical Node Selection
                        </h3>

                        <div className="mb-8 space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-4">Filter by Department</label>
                            <div className="relative">
                                <select
                                    value={selectedSpecialty}
                                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                                    className="w-full p-6 bg-white/5 border border-white/5 rounded-[2rem] text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-slate-900 text-white">Select a Department / Specialty...</option>
                                    {specialties.map(spec => (
                                        <option key={spec} value={spec} className="bg-slate-900 text-white">{spec}</option>
                                    ))}
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={20} />
                                </div>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                            {doctors
                                .filter(doc => !selectedSpecialty || doc.specialty === selectedSpecialty)
                                .map((doc) => {
                                    const congestion = getCongestion(doc.id);
                                    const recommended = selectedSpecialty && getRecommendedDoctor(selectedSpecialty)?.id === doc.id;

                                    return (
                                        <button key={doc.id} onClick={() => setSelectedDoctor(doc)} className={`p-6 rounded-[2.5rem] border text-left transition-all duration-700 group relative flex items-center gap-6 overflow-hidden ${selectedDoctor?.id === doc.id ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/5' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                                            {recommended && (
                                                <div className="absolute top-0 right-0 bg-primary/10 text-primary border-l border-b border-primary/20 px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                                    <Sparkles size={8} /> Recommended
                                                </div>
                                            )}
                                             <div className={`w-20 h-20 rounded-[2rem] border-4 overflow-hidden shadow-inner transition-transform duration-700 ${selectedDoctor?.id === doc.id ? 'border-primary rotate-3 group-hover:rotate-0' : 'border-white/10 grayscale group-hover:grayscale-0'}`}>
                                                <img src={doc.image_url || `https://ui-avatars.com/api/?name=${doc.first_name}+${doc.last_name}&background=random`} alt={doc.first_name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-lg font-black text-[var(--text-base)] uppercase tracking-tighter leading-none mb-2">Dr. {doc.first_name} {doc.last_name}</h4>
                                                <div className="flex items-center gap-3">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60 leading-none">{doc.specialty}</p>
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                                                        congestion.theme === 'emerald' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                        congestion.theme === 'amber' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                                    }`}>
                                                        {congestion.label}
                                                    </span>
                                                </div>
                                            </div>
                                            {selectedDoctor?.id === doc.id && <div className="p-2 bg-primary text-white rounded-full shrink-0"><CheckCircle2 size={16} /></div>}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity"><AlertTriangle size={64} /></div>
                        <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter mb-10 flex items-center gap-5 ">
                            <span className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 shadow-inner border border-orange-500/20"><Activity size={24} /></span>
                            Priority Meridian
                        </h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {URGENCY_LEVELS.map((level) => <UrgencyCard key={level.value} level={level} isSelected={urgency === level.value} onSelect={setUrgency} />)}
                        </div>
                    </div>

                    <button onClick={() => setStep(2)} disabled={!selectedDoctor} className="w-full py-7 bg-primary text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.5em] flex items-center justify-center gap-6 shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all disabled:opacity-50 ">Continue Sequence <ArrowRight size={20} strokeWidth={3} /></button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-12 animate-in slide-in-from-right-10 duration-700">
                    <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity"><Navigation size={64} /></div>
                        <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter mb-10 flex items-center gap-5 ">
                            <span className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner border border-primary/20"><Info size={24} /></span>
                            Symptom Lexicon
                        </h3>
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-4 ">Primary Clinical Reason *</label>
                                <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="E.G., CEPHALALGIA, FOLLOW-UP..." className="w-full p-6 bg-white/5 border border-white/5 rounded-[2rem] text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all placeholder:text-slate-700" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] pl-4 ">Extended Node Symptoms (Optional)</label>
                                <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="DETAILED NODE ANOMALIES..." rows={3} className="w-full p-6 bg-white/5 border border-white/5 rounded-[2rem] text-[var(--text-base)] font-black tracking-tight shadow-inner outline-none focus:border-primary/40 transition-all resize-none placeholder:text-slate-700" />
                            </div>
                        </div>
                    </div>

                    <VitalSignsSection vitals={vitals} setVitals={setVitals} />

                    <div className="flex gap-8">
                        <button onClick={() => setStep(1)} className="px-12 py-7 bg-white/5 border border-white/5 text-slate-500 font-black text-[12px] uppercase tracking-[0.4em] rounded-[2.5rem] hover:bg-white/10 transition-all flex items-center justify-center gap-4"><ArrowLeft size={20} /> Seq 01</button>
                        <button onClick={handleSubmit} disabled={isLoading || !reason} className="flex-1 py-7 bg-primary text-white rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.5em] flex items-center justify-center gap-6 shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all disabled:opacity-50 ">
                            {isLoading ? 'Synchronizing...' : <>Finalize Registry <CheckCircle2 size={20} strokeWidth={3} /></>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalkinRegistration;
