import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronRight, CheckCircle2, Loader2, AlertCircle, Search, Edit3 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config/api';

const InsuranceForm = ({ initialData, onSuccess, patientId: propPatientId }) => {
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        providerId: '',
        memberId: initialData?.memberId || '',
        groupId: initialData?.groupId || '',
        planType: '',
        policyHolderName: '',
        patientId: propPatientId || ''
    });
    const [verificationResult, setVerificationResult] = useState(null);

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const res = await axios.get(`${API_URL}/insurance/providers`);
            setProviders(res.data);
            
            // Try to match scanned provider name to ID if exists
            if (initialData?.provider) {
                const match = res.data.find(p => 
                    p.name.toLowerCase().includes(initialData.provider.toLowerCase())
                );
                if (match) setFormData(prev => ({ ...prev, providerId: match.id }));
            }
        } catch (err) {
            console.error(err);
            setError("Failed to load insurance providers.");
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await axios.post(`${API_URL}/insurance/save`, formData, {
                headers: { Authorization: `Bearer ${localStorage.getItem('hs_token')}` }
            });
            
            const insuranceId = res.data.id;
            
            // Automatically trigger verification
            setVerifying(true);
            const verifyRes = await axios.post(`${API_URL}/insurance/verify/${insuranceId}`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('hs_token')}` }
            });
            
            setVerificationResult(verifyRes.data);
            setVerifying(false);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to save and verify insurance.");
            setLoading(false);
            setVerifying(false);
        }
    };

    if (verificationResult) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-10 bg-green-500/5 dark:bg-green-900/10 rounded-[2rem] border border-green-500/20 text-center"
            >
                <div className="w-20 h-20 bg-green-500 text-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(34,197,94,0.4)]">
                    <CheckCircle2 size={40} />
                </div>
                <h4 className="text-2xl font-black text-green-900 dark:text-green-400 mb-3 tracking-tight">Identity Synchronized</h4>
                <p className="text-green-700 dark:text-green-300 mb-8 font-medium">{verificationResult.message}</p>
                
                <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-xl text-left mb-8 border border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network Provider</span>
                            <p className="font-bold dark:text-white">{verificationResult.provider}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Code</span>
                            <p className="font-black text-green-600 uppercase tracking-tighter">{verificationResult.status}</p>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Member Reference</span>
                            <p className="font-mono font-bold dark:text-white text-lg tracking-tighter">{verificationResult.memberId}</p>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={onSuccess}
                    className="w-full py-4 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-2xl font-black transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
                >
                    CONTINUE TO DASHBOARD
                </button>
            </motion.div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Insurance Provider</label>
                    <div className="relative group">
                        <select
                            name="providerId"
                            value={formData.providerId}
                            onChange={handleChange}
                            required
                            className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none dark:text-white font-bold transition-all appearance-none"
                        >
                            <option value="">Select Carrier</option>
                            {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <ChevronRight size={18} className="rotate-90" />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Policy Holder Name</label>
                    <div className="relative">
                        <input
                            type="text"
                            name="policyHolderName"
                            value={formData.policyHolderName}
                            onChange={handleChange}
                            placeholder="Full Legal Name"
                            className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none dark:text-white font-bold transition-all"
                        />
                        <Edit3 className="absolute right-4 top-4 text-gray-400" size={18} />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Member Reference ID</label>
                    <div className="relative">
                        <input
                            type="text"
                            name="memberId"
                            value={formData.memberId}
                            onChange={handleChange}
                            required
                            placeholder="Enter Member ID"
                            className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none dark:text-white font-mono font-bold transition-all pl-12"
                        />
                        <Shield className="absolute left-4 top-4 text-blue-500" size={20} />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Group ID (Optional)</label>
                    <input
                        type="text"
                        name="groupId"
                        value={formData.groupId}
                        onChange={handleChange}
                        placeholder="Enter Group Number"
                        className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none dark:text-white font-mono font-bold transition-all"
                    />
                </div>
            </div>

            {error && (
                <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-5 bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl flex items-start gap-4 text-sm font-bold"
                >
                    <AlertCircle size={20} className="shrink-0" />
                    {error}
                </motion.div>
            )}

            <button
                type="submit"
                disabled={loading || verifying}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white rounded-2xl font-black transition-all shadow-[0_10px_30px_rgba(59,130,246,0.3)] hover:shadow-[0_15px_40px_rgba(59,130,246,0.5)] flex items-center justify-center gap-3 transform hover:-translate-y-1 active:scale-95 mt-6"
            >
                {loading || verifying ? (
                    <>
                        <Loader2 className="animate-spin" size={24} />
                        {verifying ? 'VERIFYING ELIGIBILITY...' : 'SYNCHRONIZING...'}
                    </>
                ) : (
                    <>
                        <Shield size={24} />
                        VERIFY & ENROLL POLICY
                    </>
                )}
            </button>
        </form>
    );
};

export default InsuranceForm;
