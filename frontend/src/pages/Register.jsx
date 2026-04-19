import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Phone, MapPin, HeartPulse, ChevronRight, ShieldCheck, ArrowLeft, Calendar, Activity, Zap, Info, Shield, Heart } from 'lucide-react';
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
            setError('The passwords you entered do not match.');
            return;
        }
        if (formData.password.length < 6) {
            setError('Your password must be at least 6 characters long.');
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
                setError(data.message || 'We were unable to create your account. Please try again.');
                if (res.status === 409) setStep(1);
                return;
            }
            login(data);
            navigate('/patient-dashboard');
        } catch {
            setError('Unable to connect to the server. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient background */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse delay-1000"></div>
            
            <div className={`w-full max-w-xl transition-all duration-1000 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                {/* Logo & Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-3xl shadow-sm border border-[var(--border-base)]/30 text-primary mb-6">
                        <HeartPulse size={32} />
                    </div>
                    <h1 className="text-4xl font-bold text-[var(--text-base)] tracking-tight mb-2">Join HealthSync</h1>
                    <p className="text-[var(--text-base)]/60 font-medium">Create your secure health profile</p>
                </div>

                {/* Progress Indicators */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <div className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-primary' : 'bg-[var(--border-base)]/20'}`}></div>
                    <div className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-primary' : 'bg-[var(--border-base)]/20'}`}></div>
                </div>

                {/* Registration Form */}
                <div className="apple-card p-10 border border-[var(--border-base)]/50 shadow-xl shadow-primary/5 relative overflow-hidden">
                    {error && (
                        <div className="mb-8 p-4 bg-danger/5 border border-danger/10 text-danger text-sm rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <Shield size={18} className="shrink-0" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleStep1} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <h3 className="text-xl font-bold text-[var(--text-base)] mb-6">Basic Information</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">First Name</label>
                                    <input name="first_name" required value={formData.first_name} onChange={handleChange}
                                        className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="John" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Last Name</label>
                                    <input name="last_name" required value={formData.last_name} onChange={handleChange}
                                        className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="Doe" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={20} />
                                    <input name="email" type="email" required value={formData.email} onChange={handleChange}
                                        className="block w-full pl-12 pr-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="name@example.com" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={18} />
                                        <input name="password" type="password" required value={formData.password} onChange={handleChange}
                                            className="block w-full pl-11 pr-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="••••••••" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Confirm Password</label>
                                    <input name="confirm_password" type="password" required value={formData.confirm_password} onChange={handleChange}
                                        className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="••••••••" />
                                </div>
                            </div>

                            <button type="submit" className="w-full btn-primary py-4 text-base shadow-lg shadow-primary/20 mt-4">
                                Continue <ChevronRight size={18} />
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                            <h3 className="text-xl font-bold text-[var(--text-base)] mb-6">Additional Details</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Date of Birth</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={18} />
                                        <input name="dob" type="date" value={formData.dob} onChange={handleChange} className="block w-full pl-11 pr-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Blood Group</label>
                                    <div className="relative group">
                                         <select name="blood_group" value={formData.blood_group} onChange={handleChange} className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:ring-4 focus:ring-primary/5 outline-none appearance-none transition-all cursor-pointer">
                                            <option value="">Select Group</option>
                                            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                                                <option key={bg} value={bg}>{bg}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-[var(--text-base)]/30"><Heart size={16} /></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Phone Number</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={18} />
                                    <input name="phone" value={formData.phone} onChange={handleChange}
                                        className="block w-full pl-11 pr-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="+1 (555) 000-0000" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Residential Address</label>
                                <div className="relative group">
                                    <MapPin className="absolute left-4 top-4 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={18} />
                                    <textarea name="address" value={formData.address} onChange={handleChange} rows={2}
                                        className="block w-full pl-11 pr-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all resize-none" placeholder="123 Health St, City, Country" />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl text-primary">
                                <Info size={18} className="shrink-0" />
                                <p className="text-xs font-medium">Your data is stored securely and never shared with third parties.</p>
                            </div>

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 border border-[var(--border-base)]/30 text-[var(--text-base)]/60 font-semibold rounded-2xl hover:bg-[var(--bg-base)] transition-all flex items-center justify-center gap-2">
                                    <ArrowLeft size={18} /> Back
                                </button>
                                <button type="submit" disabled={loading} className="flex-[2] btn-primary py-4 text-base shadow-lg shadow-primary/20">
                                    {loading ? (
                                        <div className="flex items-center gap-3 justify-center">
                                            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span>Creating...</span>
                                        </div>
                                    ) : (
                                        'Create Account'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="mt-8 text-center text-sm text-[var(--text-base)]/60">
                    Already have an account?{' '}
                    <Link to="/login" className="text-primary font-semibold hover:underline">Sign in instead</Link>
                </p>
            </div>

            <div className="absolute bottom-8 text-center text-[11px] font-medium text-[var(--text-base)]/30">
                &copy; 2026 HealthSync. Secure Healthcare Portal.
            </div>
        </div>
    );
};

export default Register;
