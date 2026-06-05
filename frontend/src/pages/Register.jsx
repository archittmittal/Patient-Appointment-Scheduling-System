import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, HeartPulse, ShieldCheck, ArrowRight, Activity, Shield, User, Phone, MapPin, Droplets, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { GoogleLogin } from '@react-oauth/google';

const Register = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        dob: '',
        phone: '',
        blood_group: '',
        address: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleStep1 = (e) => {
        e.preventDefault();
        setStep(2);
    };

    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await authService.register(formData);
            
            if (data.error || !data.token) {
                setError(data.message || 'Registration failed. Please try again.');
                return;
            }
            
            login(data);
            
            const pending = localStorage.getItem('pendingBooking');
            if (pending) {
                navigate('/book');
            } else {
                navigate('/patient-dashboard');
            }
        } catch (err) {
            setError(err.message || 'Unable to connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setError('');
        setLoading(true);
        const token = credentialResponse?.credential;
        if (!token) {
            setError('Google signup was unsuccessful or canceled.');
            setLoading(false);
            return;
        }
        try {
            const data = await authService.googleLogin(token);
            
            if (data.error || !data.token) {
                setError(data.message || 'Google registration failed.');
                return;
            }

            if (data.role && data.role !== 'PATIENT') {
                setError('Doctors and Admins must sign in via the Login page.');
                authService.logout();
                return;
            }

            login(data);
            
            const pending = localStorage.getItem('pendingBooking');
            if (pending) {
                navigate('/book');
            } else {
                navigate('/patient-dashboard');
            }
        } catch (err) {
            setError(err.message || 'Unable to connect to Google SSO.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center px-6 pt-6 pb-20 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse delay-1000"></div>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
                <div className={`w-full max-w-xl transition-all duration-1000 transform ${isMounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-3xl shadow-sm border border-[var(--border-base)]/30 text-primary mb-6">
                            <HeartPulse size={32} />
                        </div>
                        <h1 className="text-4xl font-bold text-[var(--text-base)] tracking-tight mb-2">Join HealthSync</h1>
                        <p className="text-[var(--text-base)]/60 font-medium">Create your secure health profile</p>
                    </div>

                    <div className="flex items-center justify-center gap-4 mb-8">
                        <div className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-primary' : 'bg-[var(--border-base)]/20'}`}></div>
                        <div className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-primary' : 'bg-[var(--border-base)]/20'}`}></div>
                    </div>

                    <div className="apple-card p-10 border border-[var(--border-base)]/50 shadow-xl shadow-primary/5 relative overflow-hidden">
                        {error && (
                            <div className="mb-8 p-4 bg-danger/5 border border-danger/10 text-danger text-sm rounded-xl flex items-center gap-3">
                                <Shield size={18} className="shrink-0" />
                                <p className="font-medium">{error}</p>
                            </div>
                        )}

                        {step === 1 ? (
                            <form onSubmit={handleStep1} className="space-y-6">
                                <div className="mb-6 flex justify-center w-full">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => {
                                            setError('Google signup was unsuccessful or canceled.');
                                        }}
                                        text="signup_with"
                                        useOneTap
                                        theme="filled_blue"
                                        shape="pill"
                                    />
                                </div>
                                
                                <div className="mb-6 flex items-center justify-center space-x-4">
                                    <div className="h-px bg-[var(--border-base)]/30 w-full flex-1"></div>
                                    <span className="text-xs text-[var(--text-base)]/50 font-medium">OR</span>
                                    <div className="h-px bg-[var(--border-base)]/30 w-full flex-1"></div>
                                </div>

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
                                    <input type="email" name="email" required value={formData.email} onChange={handleChange}
                                        className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="john@example.com" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Password</label>
                                    <input type="password" name="password" required value={formData.password} onChange={handleChange}
                                        className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="••••••••" />
                                </div>
                                <button type="submit" className="w-full btn-primary py-4 text-base shadow-lg shadow-primary/20 mt-4">
                                    Next Step <ArrowRight size={18} />
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleFinalSubmit} className="space-y-6">
                                <h3 className="text-xl font-bold text-[var(--text-base)] mb-6">Medical & Contact Info</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Date of Birth</label>
                                        <input type="date" name="dob" value={formData.dob} onChange={handleChange}
                                            className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Blood Group</label>
                                        <select name="blood_group" value={formData.blood_group} onChange={handleChange}
                                            className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all">
                                            <option value="">Select</option>
                                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Phone Number</label>
                                    <input name="phone" required value={formData.phone} onChange={handleChange}
                                        className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="+1 (555) 000-0000" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Residential Address</label>
                                    <input name="address" required value={formData.address} onChange={handleChange}
                                        className="block w-full px-4 py-3 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all" placeholder="123 Health St, City" />
                                </div>
                                <div className="flex gap-4 mt-6">
                                    <button type="button" onClick={() => setStep(1)} className="flex-1 px-6 py-4 rounded-2xl border border-[var(--border-base)]/30 text-sm font-bold hover:bg-[var(--border-base)]/5 transition-all">Back</button>
                                    <button type="submit" disabled={loading} className="flex-[2] btn-primary py-4 text-base shadow-lg shadow-primary/20">
                                        {loading ? <Activity className="animate-spin" size={20} /> : 'Create Account'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <p className="mt-8 text-center text-sm text-[var(--text-base)]/60">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary font-semibold hover:underline">Sign in instead</Link>
                    </p>

                    <div className="mt-6 text-center">
                        <p className="text-[10px] text-[var(--text-base)]/30 font-bold uppercase tracking-[0.2em]">
                            Note: This registration is for Patients only. Doctor or Admin? Access is managed by your institution.
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="w-full mt-12 mb-8 text-center text-[11px] font-medium text-[var(--text-base)]/30 z-10">
                &copy; 2026 HealthSync. All healthcare data is encrypted and secure.
            </div>
        </div>
    );
};

export default Register;
