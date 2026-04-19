import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, HeartPulse, ShieldCheck, ArrowRight, Activity, Shield } from 'lucide-react';
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
                setError(data.message || 'The email or password you entered is incorrect.');
                return;
            }
            login(data);
            
            // Check for pending booking
            const pending = localStorage.getItem('pendingBooking');
            if (pending && data.role === 'PATIENT') {
                navigate('/book');
            } else {
                navigate(ROLE_HOME[data.role] || '/login');
            }
        } catch {
            setError('Unable to connect to the server. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center p-6 relative overflow-hidden">
            {/* Soft Ambient Background */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse delay-1000"></div>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
                <div className={`w-full max-w-md transition-all duration-1000 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                    {/* Logo & Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-3xl shadow-sm border border-[var(--border-base)]/30 text-primary mb-6 animate-in zoom-in duration-700">
                            <HeartPulse size={32} />
                        </div>
                        <h1 className="text-4xl font-bold text-[var(--text-base)] tracking-tight mb-2">HealthSync</h1>
                        <p className="text-[var(--text-base)]/60 font-medium">Sign in to your health portal</p>
                    </div>

                    {/* Login Form */}
                    <div className="apple-card p-10 border border-[var(--border-base)]/50 shadow-xl shadow-primary/5">
                        {error && (
                            <div className="mb-8 p-4 bg-danger/5 border border-danger/10 text-danger text-sm rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <Shield size={18} className="shrink-0" />
                                <p className="font-medium">{error}</p>
                            </div>
                        )}
                        
                        <form className="space-y-6" onSubmit={handleLogin}>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all placeholder:text-[var(--text-base)]/20"
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70">Password</label>
                                    <Link to="/forgot-password" size="sm" className="text-xs font-semibold text-primary hover:underline">Forgot password?</Link>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary py-4 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 mt-4"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Signing in...</span>
                                    </div>
                                ) : (
                                    <>Sign In <ArrowRight size={18} /></>
                                )}
                            </button>
                        </form>

                        <div className="mt-10 pt-8 border-t border-[var(--border-base)]/30 text-center">
                            <p className="text-sm text-[var(--text-base)]/60">
                                Don't have an account?{' '}
                                <Link to="/register" className="text-primary font-semibold hover:underline">Create account</Link>
                            </p>
                        </div>
                    </div>

                    {/* Demo Access */}
                    <div className="mt-10 pt-6 border-t border-[var(--border-base)]/10">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck size={16} className="text-primary" />
                            <span className="text-xs font-semibold text-[var(--text-base)]/40 uppercase tracking-wider">Demo Accounts</span>
                        </div>
                        <div className="space-y-2">
                            <div onClick={() => { setEmail('patient@healthsync.com'); setPassword('password123'); }} className="cursor-pointer">
                                <CredentialItem role="Patient" email="patient@healthsync.com" pass="password123" />
                            </div>
                            <div onClick={() => { setEmail('doctor@healthsync.com'); setPassword('password123'); }} className="cursor-pointer">
                                <CredentialItem role="Doctor" email="doctor@healthsync.com" pass="password123" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-auto text-center text-[11px] font-medium text-[var(--text-base)]/30 pb-8 z-10">
                &copy; 2026 HealthSync. All healthcare data is encrypted and secure.
            </div>
        </div>
    );
};

const CredentialItem = ({ role, email, pass }) => (
    <div className="flex justify-between items-center p-3 bg-[var(--bg-base)]/50 rounded-xl border border-[var(--border-base)]/20 hover:border-primary/30 transition-colors">
        <span className="text-xs font-semibold text-[var(--text-base)]/60">{role}</span>
        <span className="text-[11px] font-medium text-[var(--text-base)]/50">{email} / {pass}</span>
    </div>
);

export default Login;
