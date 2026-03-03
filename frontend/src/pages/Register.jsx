import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Phone, MapPin, HeartPulse } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../config/api';

const Register = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [step, setStep] = useState(1); // 1 = account, 2 = personal details
    const [formData, setFormData] = useState({
        first_name: '', last_name: '', email: '', password: '', confirm_password: '',
        dob: '', phone: '', blood_group: '', address: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleStep1 = (e) => {
        e.preventDefault();
        setError('');
        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
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
                setError(data.message || 'Registration failed');
                if (res.status === 409) setStep(1);
                return;
            }
            // Auto-login on success
            login(data);
            navigate('/patient-dashboard');
        } catch {
            setError('Cannot connect to server. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50 transition-colors";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center text-primary mb-4">
                    <HeartPulse size={48} strokeWidth={1.5} />
                </div>
                <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
                    Create Patient Account
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
                </p>
            </div>

            {/* Step indicators */}
            <div className="sm:mx-auto sm:w-full sm:max-w-md mt-4">
                <div className="flex items-center gap-2 justify-center mb-6">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                    <div className={`flex-1 h-1 max-w-16 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`}></div>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                </div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Step 1: Account credentials */}
                    {step === 1 && (
                        <form onSubmit={handleStep1} className="space-y-4">
                            <h3 className="text-base font-semibold text-gray-700 mb-4">Account Information</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input name="first_name" required value={formData.first_name} onChange={handleChange}
                                            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                            placeholder="John" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
                                    <input name="last_name" required value={formData.last_name} onChange={handleChange}
                                        className={inputClass} placeholder="Doe" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input name="email" type="email" required value={formData.email} onChange={handleChange}
                                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                        placeholder="you@example.com" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input name="password" type="password" required value={formData.password} onChange={handleChange}
                                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                        placeholder="Min. 6 characters" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm Password *</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input name="confirm_password" type="password" required value={formData.confirm_password} onChange={handleChange}
                                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                        placeholder="Re-enter password" />
                                </div>
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-colors mt-2">
                                Continue
                            </button>
                        </form>
                    )}

                    {/* Step 2: Personal / medical details */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <h3 className="text-base font-semibold text-gray-700 mb-4">Personal &amp; Medical Details</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label>
                                    <input name="dob" type="date" value={formData.dob} onChange={handleChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Blood Group</label>
                                    <select name="blood_group" value={formData.blood_group} onChange={handleChange} className={inputClass}>
                                        <option value="">Select</option>
                                        {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                                            <option key={bg} value={bg}>{bg}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input name="phone" value={formData.phone} onChange={handleChange}
                                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
                                        placeholder="+1 555 000 0000" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                                    <textarea name="address" value={formData.address} onChange={handleChange} rows={2}
                                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50 resize-none"
                                        placeholder="Your home address" />
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">Date of birth, blood group, phone and address are optional and can be updated later in your profile.</p>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                                    Back
                                </button>
                                <button type="submit" disabled={loading} className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60">
                                    {loading ? 'Creating account...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Register;
