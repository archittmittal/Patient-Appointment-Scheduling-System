import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, HeartPulse, ShieldCheck, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const ResetPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [email] = useState(location.state?.email || '');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await apiClient.post('/api/auth/reset-password', { email, otp, newPassword });
            if (data && data.error) {
                setError(data.message || 'Error resetting password');
                return;
            }
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError('Server error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-6">
                    <ShieldCheck size={32} />
                </div>
                <h1 className="text-3xl font-bold mb-4">Password Updated</h1>
                <p className="text-[var(--text-base)]/60 max-w-sm mb-8">Your password has been reset successfully. You will be redirected to the sign-in page in a moment.</p>
                <Link to="/login" className="btn-primary px-8">Sign In Now</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center p-6 relative overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
                <div className="w-full max-w-md">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-3xl shadow-sm border border-[var(--border-base)]/30 text-primary mb-6">
                            <KeyRound size={32} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Complete Reset</h1>
                        <p className="text-[var(--text-base)]/60 font-medium">Verify your OTP and choose a new password</p>
                    </div>

                    <div className="apple-card p-10">
                        {error && (
                            <div className="mb-6 p-4 bg-danger/5 border border-danger/10 text-danger text-sm rounded-xl">
                                <p className="font-medium">{error}</p>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleReset}>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70">One-Time Password (OTP)</label>
                                <input
                                    type="text"
                                    required
                                    maxLength="6"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                    className="block w-full px-4 py-3.5 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-center text-2xl font-bold tracking-[10px] focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all"
                                    placeholder="000000"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70">New Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary" size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-[var(--text-base)]/70">Confirm New Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-base)]/30 group-focus-within:text-primary" size={20} />
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="block w-full pl-12 pr-4 py-3.5 bg-[var(--bg-base)]/50 border border-[var(--border-base)]/30 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/30 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary py-4 text-base shadow-lg shadow-primary/20 mt-4"
                            >
                                {loading ? 'Updating...' : <span className="flex items-center justify-center gap-2">Reset Password <ArrowRight size={18} /></span>}
                            </button>
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

export default ResetPassword;
