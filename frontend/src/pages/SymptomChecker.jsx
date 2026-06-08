import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Activity, ChevronRight, Sparkles, Stethoscope, Clock, 
    ArrowRight, AlertCircle, Heart, ShieldCheck, Compass, Info,
    UserCheck, DollarSign, RefreshCw, Send, CheckCircle
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

const SymptomChecker = () => {
    const navigate = useNavigate();
    const [symptomsInput, setSymptomsInput] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisLog, setAnalysisLog] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const analysisPhrases = [
        'Extracting symptom keywords...',
        'Matching clinical database patterns...',
        'Aligning specialty mapping vectors...',
        'Analyzing active practitioner workloads...',
        'Compiling wait-time telemetry results...'
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!symptomsInput.trim()) return;

        setAnalyzing(true);
        setError('');
        setResult(null);
        setAnalysisLog([]);

        // Run a simulated step-by-step diagnostic log animation
        for (let i = 0; i < analysisPhrases.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 600));
            setAnalysisLog(prev => [...prev, analysisPhrases[i]]);
        }

        try {
            const data = await apiClient.post('/api/symptom-checker/analyze', { symptoms: symptomsInput });
            if (data && !data.error) {
                setResult(data);
            } else {
                setError(data.message || 'Symptom analysis failed. Please try again.');
            }
        } catch (err) {
            console.error('Analysis failed:', err);
            setError('Unable to reach the diagnostic server. Please check your connection.');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSelectDoctor = (doctor) => {
        // Save state to pendingBooking in localStorage so BookAppointment reads it
        const bookingState = {
            doctorId: doctor.id,
            specialty: doctor.specialty,
            step: 2 // Skip directly to date/time selection step
        };
        localStorage.setItem('pendingBooking', JSON.stringify(bookingState));
        navigate('/book', { state: { symptoms: symptomsInput } });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-24 px-4 md:px-6 animate-in fade-in duration-700">
            {/* Header section */}
            <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="w-16 h-16 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                        <Activity size={28} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none mb-3">Diagnostic Hub</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">AI-guided symptom analyzer & specialty routing</p>
                    </div>
                </div>
            </div>

            {/* Input & Analyzer Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* Left side: Form input */}
                <div className="md:col-span-7 space-y-6">
                    <div className="glass-card p-8 rounded-[3rem] border border-slate-100/20 shadow-xl relative overflow-hidden">
                        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-6">Describe Your Symptoms</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <label htmlFor="symptoms-input" className="sr-only">Describe your symptoms</label>
                            <textarea
                                id="symptoms-input"
                                value={symptomsInput}
                                onChange={(e) => setSymptomsInput(e.target.value)}
                                disabled={analyzing}
                                placeholder="Enter how you are feeling (e.g. 'I have had severe chest tightness, high blood pressure, and racing palpitations for 2 days')..."
                                className="w-full bg-slate-50/50 border border-slate-200 p-6 rounded-[2rem] text-sm font-semibold text-[var(--text-base)] focus:outline-none focus:border-primary/40 focus:bg-white transition-all shadow-inner h-40 resize-none leading-relaxed"
                            />
                            {error && (
                                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <AlertCircle size={16} /> {error}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={analyzing || !symptomsInput.trim()}
                                className={`w-full py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 transition-all ${
                                    analyzing || !symptomsInput.trim()
                                        ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary text-white shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5'
                                }`}
                            >
                                {analyzing ? 'Analyzing Telemetry...' : <><Send size={16} /> Run Diagnostics</>}
                            </button>
                        </form>
                    </div>

                    {/* Disclaimer box */}
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex gap-4">
                        <Info className="text-slate-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-1">Clinical Disclaimer</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                                This symptom checker is a routing tool designed to suggest appropriate medical specialties. It is not an automated medical diagnostic and does not replace professional consultation. In case of emergency, proceed to the nearest emergency room.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right side: Analyzing Logger or Mapped Results */}
                <div className="md:col-span-5">
                    {/* Scenario 1: Analyzer Loading Logs */}
                    {analyzing && (
                        <div className="glass-card p-8 rounded-[3rem] border border-slate-100/20 shadow-xl space-y-6 min-h-[300px] flex flex-col justify-between">
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <RefreshCw size={14} className="animate-spin text-primary" /> Active Analyzing Log
                                </h3>
                                <div className="space-y-3 font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                                    {analysisLog.map((log, idx) => (
                                        <div key={idx} className="flex items-center gap-2 animate-in fade-in duration-300">
                                            <span className="text-primary font-black">&gt;</span>
                                            <span>{log}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-center gap-2 py-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Scenario 2: Result Presentation */}
                    {result && !analyzing && (
                        <div className="glass-card p-8 rounded-[3rem] border border-slate-100/20 shadow-xl space-y-8 animate-in zoom-in-95 duration-500">
                            <div className="space-y-4">
                                <span className="px-4 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                                    Specialty Decrypted
                                </span>
                                <div className="flex items-center gap-4 mt-2">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                                        <Stethoscope size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-[var(--text-base)] uppercase tracking-tighter leading-none">
                                            {result.mappedSpecialty}
                                        </h3>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5 leading-none">Department Recommendation</p>
                                    </div>
                                </div>
                                <p className="text-xs font-semibold text-slate-600 leading-relaxed pt-2">
                                    {result.explanation}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Scenario 3: Empty/Idle state */}
                    {!analyzing && !result && (
                        <div className="glass-card p-8 rounded-[3rem] border border-slate-100/20 shadow-xl text-center py-20 min-h-[300px] flex flex-col items-center justify-center space-y-4">
                            <Compass size={48} className="text-slate-200" />
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Awaiting Symptoms telemetry</h3>
                            <p className="text-xs text-slate-400 font-semibold leading-relaxed max-w-xs mx-auto">
                                Type details of your physical condition on the left to start the AI clinical router.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Suggested Doctor Node Listings */}
            {result && !analyzing && (
                <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-2 px-1">
                        <Sparkles size={16} className="text-primary animate-pulse" />
                        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em]">Recommended Specialists</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {result.suggestedDoctors.map((doc) => {
                            // Define wait status color coding
                            const waitMinutes = doc.estimatedWaitMins;
                            const isHighWait = waitMinutes > 40;
                            const isMedWait = waitMinutes > 15 && waitMinutes <= 40;
                            
                            return (
                                <div key={doc.id} className="glass-card rounded-[2.5rem] p-6 border border-slate-100/20 hover:border-primary/20 hover:shadow-2xl transition-all duration-500 flex flex-col justify-between gap-6 group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:scale-110 transition-transform"><Stethoscope size={70} /></div>
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-inner shrink-0 group-hover:rotate-6 transition-transform">
                                                <Stethoscope size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 leading-tight group-hover:text-primary transition-colors text-base">{doc.name}</h4>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{doc.specialty}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{doc.locationRoom || 'Medical Center'}</p>
                                            </div>
                                        </div>
                                        {/* Rating */}
                                        <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                            ★ {doc.rating.toFixed(1)}
                                        </div>
                                    </div>

                                    {/* Workload wait-time and fee summary */}
                                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100/50 text-xs uppercase tracking-wider font-semibold">
                                        <div className="space-y-1.5">
                                            <span className="text-[8px] font-black text-slate-400 tracking-widest">Congestion Wait</span>
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} className="text-slate-500" />
                                                <span className={`text-[11px] font-black ${
                                                    isHighWait ? 'text-rose-500' : isMedWait ? 'text-amber-500' : 'text-emerald-500'
                                                }`}>
                                                    {waitMinutes > 0 ? `~${waitMinutes} Mins` : 'Immediate'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-[8px] font-black text-slate-400 tracking-widest">Consult Fee</span>
                                            <div className="flex items-center gap-1 text-[11px] font-black text-primary">
                                                <span>₹{doc.consultationFee.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action button */}
                                    <button 
                                        onClick={() => handleSelectDoctor(doc)}
                                        className="btn-primary w-full py-4 text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-md shadow-primary/10"
                                    >
                                        Select & Book <ArrowRight size={14} />
                                    </button>
                                </div>
                            );
                        })}
                        {result.suggestedDoctors.length === 0 && (
                            <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-white">
                                <Stethoscope size={36} className="mx-auto text-slate-300 mb-4 animate-pulse" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No active specialists detected in registry</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SymptomChecker;
