import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, HeartPulse, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { API } from '../config/api';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const res = await fetch(`${API}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'Error sending OTP');
                return;
            }
            setMessage('A 6-digit OTP has been sent to your email.');
            setTimeout(() => {
                navigate('/reset-password', { state: { email } });
            }, 2000);
        } catch (err) {
            setError('Server error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center p-6 relative overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
                <div className="w-full max-w-md">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-3xl shadow-sm border border-[var(--border-base)]/30 text-primary mb-6">
                            <HeartPulse size={32} />
                        </div>
                        <h1 className="text-3xl font-bold text-[var(--text-base)] tracking-tight mb-2">Reset Password</h1>
                        <p className="text-[var(--text-base)]/60 font-medium">Enter your email to receive a recovery OTP</p>
                    </div>

                    <div className="apple-card p-10">
                        {error && (
                            <div className="mb-6 p-4 bg-danger/5 border border-danger/10 text-danger text-sm rounded-xl flex items-center gap-3">
                                <p className="font-medium">{error}</p>
                            </div>
                        )}
                        {message && (
                            <div className="mb-6 p-4 bg-success/5 border border-success/10 text-success text-sm rounded-xl flex items-center gap-3">
                                <ShieldCheck size={18} />
                                <p className="font-medium">{message}</p>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70 ml-1">Email Address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all"
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary py-4 text-base shadow-lg shadow-primary/20 mt-4"
                            >
                                {loading ? 'Sending OTP...' : <span className="flex items-center justify-center gap-2">Send OTP <ArrowRight size={18} /></span>}
                            </button>

                            <Link 
                                to="/login" 
                                className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-base)]/60 hover:text-primary transition-colors mt-6"
                            >
                                <ArrowLeft size={16} /> Back to Sign In
                            </Link>
                        </form>
                    </div>
                </div>
            </div>
            
            <div className="mt-auto text-center text-[11px] font-medium text-[var(--text-base)]/30 pb-8 z-10">
                &copy; 2026 HealthSync. All healthcare data is encrypted and secure.
            </div>
        </div>
    );
};

export default ForgotPassword;
