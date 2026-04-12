/**
 * Issue #51: Login Page - FINAL PREMIUM AUDIT
 * Registry Entry Protocol for high-fidelity clinical access.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, HeartPulse, ShieldCheck, ArrowRight, Sparkles, Zap, Activity, Globe, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

const ROLE_HOME = {
    PATIENT: '/patient-dashboard',
    DOCTOR: '/doctor-dashboard',
    ADMIN: '/admin-dashboard',
};

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Authentication failed');
                return;
            }
            login(data);
            navigate(ROLE_HOME[data.role] || '/login');
        } catch {
            setError('Registry link Offline. Check server connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-1000">
            {/* High-Fidelity Ambient Background */}
            <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[160px] -z-10 animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[160px] -z-10 animate-pulse-slow-delayed"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)] -z-10"></div>
            
            <div className={`sm:mx-auto sm:w-full sm:max-w-md relative z-10 transition-all duration-1000 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="flex justify-center mb-10">
                    <div className="w-24 h-24 bg-primary/10 border border-primary/20 rounded-[3rem] flex items-center justify-center text-primary shadow-2xl shadow-primary/20 group hover:scale-110 hover:rotate-6 transition-all duration-700 relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/10 scale-0 group-hover:scale-150 rounded-full transition-transform duration-1000"></div>
                        <HeartPulse size={48} strokeWidth={2.5} className="animate-pulse relative z-10" />
                    </div>
                </div>
                <h2 className="text-center text-6xl font-black text-[var(--test-base)] tracking-tighter uppercase italic leading-none">HealthSync</h2>
                <div className="flex flex-col items-center mt-4 space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic leading-none">Registry Entry Protocol</p>
                    <div className="flex items-center gap-3">
                        <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 flex items-center gap-2 shadow-inner">
                            <ShieldCheck size={14} strokeWidth={2.5} className="animate-pulse" /> SOC2 COMPLIANT
                        </span>
                        <span className="px-4 py-1.5 bg-white/5 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 flex items-center gap-2 shadow-inner">
                            <Globe size={14} /> GLOBAL NODE
                        </span>
                    </div>
                </div>
            </div>

            <div className={`mt-12 sm:mx-auto sm:w-full sm:max-w-md relative z-10 transition-all duration-1000 delay-300 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <div className="glass-modal p-12 rounded-[4rem] border-none shadow-2xl shadow-primary/10 relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000"><Zap size={100} /></div>
                    
                    {error && (
                        <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center gap-4 animate-in shake duration-500 italic">
                            <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20"><Lock size={18} /></div>
                            {error}
                        </div>
                    )}
                    
                    <form className="space-y-8" onSubmit={handleLogin}>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Unit Identity (Email)</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors">
                                    <Mail size={20} strokeWidth={2.5} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="block w-full pl-20 pr-8 py-6 bg-white/5 border border-white/5 rounded-[2.5rem] text-[13px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic"
                                    placeholder="IDENTITY@HEALTHSYNC.NEXUS"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] ml-4 block italic">Security Hash (Password)</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none text-slate-400 group-focus-within/input:text-primary transition-colors">
                                    <Lock size={20} strokeWidth={2.5} />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="block w-full pl-20 pr-8 py-6 bg-white/5 border border-white/5 rounded-[2.5rem] text-[13px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-slate-700 shadow-inner italic"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center gap-6 py-6 px-8 bg-primary text-white font-black text-[12px] uppercase tracking-[0.5em] rounded-[2.5rem] shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 active:scale-[0.98] transition-all disabled:opacity-50 group/btn italic"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-4">
                                        <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>SYNTHESIZING...</span>
                                    </div>
                                ) : (
                                    <>Initiate Protocol <ArrowRight size={20} className="group-hover/btn:translate-x-2 transition-transform duration-500" /> </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-12 pt-10 border-t border-white/5">
                        <div className="p-8 bg-white/5 rounded-[3rem] border border-white/5 space-y-6 relative overflow-hidden group/creds transition-all duration-700 hover:bg-white/10">
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover/creds:opacity-20 transition-opacity">
                                <Sparkles size={32} className="text-primary" />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20"><Activity size={18} /></div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] italic">Test Vectors</p>
                            </div>
                            <div className="space-y-4 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                                <CredentialRow role="Patient" email="patient@example.com" pass="patient123" />
                                <CredentialRow role="Physician" email="dr.sarah@hospital.com" pass="doctor123" />
                                <CredentialRow role="Administrator" email="admin@hospital.com" pass="admin123" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 text-center text-[10px] font-black uppercase tracking-[0.4em] italic">
                        <p className="text-slate-600">
                            New Subject?{' '}
                            <Link to="/register" className="text-primary hover:text-primary-hover hover:underline ml-2 transition-colors">Generate Neural Profile</Link>
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

const CredentialRow = ({ role, email, pass }) => (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 group/row p-4 rounded-2xl hover:bg-white/5 transition-all">
        <span className="text-slate-600 group-hover/row:text-primary transition-colors">{role}:</span>
        <span className="text-slate-500 group-hover/row:text-[var(--test-base)]">{email} / <span className="text-amber-500/80">{pass}</span></span>
    </div>
);

export default Login;
