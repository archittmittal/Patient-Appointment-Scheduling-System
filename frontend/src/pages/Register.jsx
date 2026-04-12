/**
 * Issue #51: Register Page - FINAL PREMIUM AUDIT
 * Neutral Registry Generation for high-fidelity clinical onboarding.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Phone, MapPin, HeartPulse, ChevronRight, ShieldCheck, Sparkles, ArrowLeft, Calendar, Activity, Zap, Info, Shield, Globe, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

const Register = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [step, setStep] = useState(1);
    const [isMounted, setIsMounted] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', email: '', password: '', confirm_password: '',
        dob: '', phone: '', blood_group: '', address: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleStep1 = (e) => {
        e.preventDefault();
        setError('');
        if (formData.password !== formData.confirm_password) {
            setError('Neural validation failed: Passwords mismatch');
            return;
        }
        if (formData.password.length < 6) {
            setError('Security protocol: Hash must be 6+ characters');
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    dob: formData.dob || null,
                    phone: formData.phone,
                    blood_group: formData.blood_group,
                    address: formData.address,
                })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Registry creation failed');
                if (res.status === 409) setStep(1);
                return;
            }
            login(data);
            navigate('/patient-dashboard');
        } catch {
            setError('Registry link Offline. Check server connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-1000">
            {/* High-Fidelity Ambient Background */}
            <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[160px] -z-10 animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[160px] -z-10 animate-pulse-slow-delayed"></div>
            <div className="absolute top-1/4 left-1/4 w-[200px] h-[200px] bg-indigo-500/5 rounded-full blur-[80px] -z-10"></div>
            
            <div className={`sm:mx-auto sm:w-full sm:max-w-xl relative z-10 transition-all duration-1000 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="flex justify-center mb-10">
                    <div className="w-24 h-24 bg-primary/10 border border-primary/20 rounded-[3rem] flex items-center justify-center text-primary shadow-2xl shadow-primary/20 group hover:scale-110 hover:rotate-[-6deg] transition-all duration-700 relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/10 scale-0 group-hover:scale-150 rounded-full transition-transform duration-1000"></div>
                        <HeartPulse size={48} strokeWidth={2.5} className="animate-pulse relative z-10" />
                    </div>
                </div>
                <h2 className="text-center text-5xl font-black text-[var(--test-base)] tracking-tighter uppercase italic leading-none">Neural Registry</h2>
                <div className="flex flex-col items-center mt-6 space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic leading-none">Profile Generation Sequence</p>
                    <div className="flex items-center gap-3">
                        <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-2 shadow-inner">
                            <ShieldCheck size={14} strokeWidth={2.5} className="animate-pulse" /> UNIQUE ID ASSIGNMENT
                        </span>
                    </div>
                </div>
            </div>

            {/* Premium Stepper Sequence */}
            <div className={`sm:mx-auto sm:w-full sm:max-w-md mt-12 relative z-10 transition-all duration-1000 delay-300 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="flex items-center gap-6 justify-center mb-12">
                    <div className={`flex items-center justify-center w-14 h-14 rounded-[1.5rem] text-[12px] font-black transition-all duration-700 shadow-2xl ${step >= 1 ? 'bg-primary text-white shadow-primary/30 border border-primary-light/20 rotate-12' : 'bg-white/5 border border-white/10 text-slate-600'}`}>01</div>
                    <div className={`flex-1 h-1 max-w-[60px] rounded-full transition-all duration-1000 ${step >= 2 ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-white/5'}`}></div>
                    <div className={`flex items-center justify-center w-14 h-14 rounded-[1.5rem] text-[12px] font-black transition-all duration-700 shadow-2xl ${step >= 2 ? 'bg-primary text-white shadow-primary/30 border border-primary-light/20 rotate-12' : 'bg-white/5 border border-white/10 text-slate-600'}`}>02</div>
                </div>
            </div>

            <div className={`sm:mx-auto sm:w-full sm:max-w-xl relative z-10 transition-all duration-1000 delay-500 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="glass-modal p-12 rounded-[5rem] border-none shadow-2xl shadow-primary/10 relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000"><Zap size={120} /></div>
                    
                    {error && (
                        <div className="mb-10 p-5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-3xl text-[11px] font-black uppercase tracking-widest flex items-center gap-4 animate-in slide-in-from-top-4 duration-500 italic">
                             <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20"><Lock size={18} /></div>
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <form onSubmit={handleStep1} className="space-y-8 animate-in slide-in-from-right-8 duration-700">
                            <div className="flex items-center gap-6 mb-10">
                                <div className="p-5 bg-primary/10 rounded-[1.75rem] border border-primary/20 text-primary group-hover:rotate-12 transition-all duration-700">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[var(--test-base)] uppercase tracking-tighter italic leading-none mb-1">Identity Core</h3>
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] italic opacity-60">Primary biometric index mapping</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">First Axis</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors"><User size={18} strokeWidth={2.5} /></div>
                                        <input name="first_name" required value={formData.first_name} onChange={handleChange}
                                            className="block w-full pl-16 pr-6 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic" placeholder="JOHN" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Last Axis</label>
                                    <input name="last_name" required value={formData.last_name} onChange={handleChange}
                                        className="block w-full px-8 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic" placeholder="DOE" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Email Identifier</label>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors"><Mail size={18} strokeWidth={2.5} /></div>
                                    <input name="email" type="email" required value={formData.email} onChange={handleChange}
                                        className="block w-full pl-16 pr-6 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic" placeholder="ID@HEALTHSYNC.NEXUS" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Security Hash</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors"><Lock size={18} strokeWidth={2.5} /></div>
                                        <input name="password" type="password" required value={formData.password} onChange={handleChange}
                                            className="block w-full pl-16 pr-6 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic" placeholder="••••••••" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Verification</label>
                                    <input name="confirm_password" type="password" required value={formData.confirm_password} onChange={handleChange}
                                        className="block w-full px-8 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic" placeholder="••••••••" />
                                </div>
                            </div>

                            <button type="submit" className="w-full flex justify-center items-center gap-6 py-6 px-8 bg-primary text-white font-black text-[12px] uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 active:scale-[0.98] transition-all group/btn italic">
                                Next Sequence <ChevronRight size={20} className="group-hover/btn:translate-x-2 transition-transform duration-500" />
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-8 animate-in slide-in-from-right-8 duration-700">
                             <div className="flex items-center gap-6 mb-10">
                                <div className="p-5 bg-emerald-500/10 rounded-[1.75rem] border border-emerald-500/20 text-emerald-500 group-hover:rotate-12 transition-all duration-700">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[var(--test-base)] uppercase tracking-tighter italic leading-none mb-1">Metadata Node</h3>
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] italic opacity-60">Biometric auxiliary synchronizers</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Birth Cycle</label>
                                    <div className="relative group/input">
                                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors"><Calendar size={18} /></div>
                                        <input name="dob" type="date" value={formData.dob} onChange={handleChange} className="block w-full pl-16 pr-6 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all outline-none italic" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Blood Type Index</label>
                                    <div className="relative group/input">
                                         <select name="blood_group" value={formData.blood_group} onChange={handleChange} className="block w-full px-8 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:ring-4 focus:ring-primary/10 outline-none appearance-none italic transition-all shadow-inner cursor-pointer">
                                            <option value="" className="bg-slate-900">SELECT TYPE</option>
                                            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                                                <option key={bg} value={bg} className="bg-slate-900">{bg}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-6 flex items-center pointer-events-none text-slate-400"><Heart size={16} /></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Comms Link (Phone)</label>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors"><Phone size={18} strokeWidth={2.5} /></div>
                                    <input name="phone" value={formData.phone} onChange={handleChange}
                                        className="block w-full pl-16 pr-6 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic" placeholder="+1 000 000 0000" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Geospatial Localization (Address)</label>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-6 pt-5 flex items-start pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors"><MapPin size={18} strokeWidth={2.5} /></div>
                                    <textarea name="address" value={formData.address} onChange={handleChange} rows={2}
                                        className="block w-full pl-16 pr-8 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[12px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner resize-none italic" placeholder="UNIT COORDINATES..." />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-5 bg-white/5 border border-white/5 rounded-3xl opacity-60 italic">
                                <Info size={16} className="text-primary flex-shrink-0" />
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">Packets are encrypted and strictly pruned in node settings.</p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-6">
                                <button type="button" onClick={() => setStep(1)} className="flex-1 py-6 border border-white/5 text-slate-500 font-black text-[12px] uppercase tracking-[0.4em] rounded-[2.5rem] hover:bg-white/5 transition-all flex items-center justify-center gap-4 group/back italic">
                                    <ArrowLeft size={18} className="group-hover/back:-translate-x-2 transition-transform duration-500" /> Seq 01
                                </button>
                                <button type="submit" disabled={loading} className="flex-[2] py-6 bg-primary text-white font-black text-[12px] uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-1 active:scale-[0.98] transition-all disabled:opacity-50 italic">
                                    {loading ? (
                                        <div className="flex items-center gap-4 justify-center">
                                            <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>SYNTHESIZING...</span>
                                        </div>
                                    ) : (
                                        'Finalize Registry'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.4em] italic pt-10 border-t border-white/5">
                        <p className="text-slate-600">
                            Already Indexed?{' '}
                            <Link to="/login" className="text-primary hover:text-primary-hover hover:underline ml-2 transition-colors">Initiate Protocol</Link>
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-12 text-center text-[9px] font-black text-slate-700 uppercase tracking-[0.8em] italic opacity-40">
                HealthSync Nexus © 2026 • Secure Decentralized Architecture
            </div>
        </div>
    );
};

export default Register;
