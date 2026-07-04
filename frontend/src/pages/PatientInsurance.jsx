import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Shield, Camera, Plus, History, CheckCircle2, AlertTriangle, ChevronRight, Info, Clock, X, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';
// InsuranceScanner bundles tesseract.js (~4 MB) — lazy-loaded so it is only
// fetched when the user opens the scanner modal, not on initial page load.
const InsuranceScanner = lazy(() => import('../components/InsuranceScanner'));
import InsuranceForm from '../components/InsuranceForm';
import { motion, AnimatePresence } from 'framer-motion';

const PatientInsurance = () => {
    const [insuranceList, setInsuranceList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showScanner, setShowScanner] = useState(false);
    const [scannedData, setScannedData] = useState(null);
    const [showForm, setShowForm] = useState(false);

    const fetchInsurance = async () => {
        try {
            const data = await apiClient.get('/api/insurance/my');
            setInsuranceList(data && !data.error ? data : []);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsurance();
    }, []);

    const handleScanComplete = (data) => {
        setScannedData(data);
        setShowScanner(false);
        setShowForm(true);
    };

    const handleSuccess = () => {
        setShowForm(false);
        setScannedData(null);
        fetchInsurance();
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 px-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h1 className="text-4xl font-black tracking-tight text-emerald-900 dark:text-white mb-3 sm:bg-gradient-to-r sm:from-emerald-600 sm:to-teal-600 sm:bg-clip-text sm:text-transparent">
                        Insurance Vault
                    </h1>
                    <p className="text-gray-500 font-medium">Manage your digital health wallet and verify policies instantly.</p>
                </motion.div>
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4"
                >
                    <button 
                        onClick={() => setShowScanner(true)}
                        className="flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black transition-all shadow-[0_10px_25px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_35px_rgba(16,185,129,0.5)] transform hover:-translate-y-1 active:scale-95"
                    >
                        <Camera size={20} />
                        Smart Scan
                    </button>
                    <button 
                        onClick={() => { setScannedData(null); setShowForm(true); }}
                        className="flex items-center gap-3 px-6 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 dark:text-white rounded-2xl font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm transform hover:-translate-y-1 active:scale-95"
                    >
                        <Plus size={20} />
                        Manual Entry
                    </button>
                </motion.div>
            </div>

            <AnimatePresence>
                {showScanner && (
                    <Suspense fallback={
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                            <div className="text-white font-semibold">Loading Scanner…</div>
                        </div>
                    }>
                        <InsuranceScanner 
                            onScanComplete={handleScanComplete} 
                            onClose={() => setShowScanner(false)} 
                        />
                    </Suspense>
                )}

                {showForm && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.1)] border border-white/20 dark:border-gray-800 mb-12"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                                    <Shield size={28} />
                                </div>
                                <h2 className="text-2xl font-black dark:text-white tracking-tight">
                                    {scannedData ? 'Review Scanned Policy' : 'Policy Enrollment'}
                                </h2>
                            </div>
                            <button 
                                onClick={() => setShowForm(false)} 
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <InsuranceForm initialData={scannedData} onSuccess={handleSuccess} />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Active Coverage</h3>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-emerald-500" size={48} />
                    </div>
                ) : insuranceList.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-gray-50/50 dark:bg-gray-900/40 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-16 text-center"
                    >
                        <div className="w-20 h-20 bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <Shield size={40} />
                        </div>
                        <h4 className="text-2xl font-black dark:text-white mb-3 tracking-tight">No Insurance Linked</h4>
                        <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">Link your insurance card to unlock automated billing and priority check-ins.</p>
                        <button 
                            onClick={() => setShowScanner(true)}
                            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-500/25 transform hover:-translate-y-1 active:scale-95"
                        >
                            <Camera size={20} />
                            Initiate Smart Scan
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {insuranceList.map((insurance, index) => (
                            <motion.div 
                                key={insurance.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-500 group overflow-hidden shadow-sm hover:shadow-xl hover:shadow-emerald-500/5"
                            >
                                <div className="absolute -right-12 -top-12 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors duration-500" />
                                
                                <div className="flex items-start justify-between mb-8 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                                            <Shield size={28} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black dark:text-white tracking-tight group-hover:text-emerald-600 transition-colors">{insurance.provider_name}</h4>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{insurance.plan_type || 'Premium Care Plan'}</p>
                                        </div>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        insurance.status === 'VERIFIED' || insurance.status === 'ACTIVE' 
                                        ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {insurance.status}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-8 relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Member ID</p>
                                        <p className="font-mono text-sm font-bold dark:text-gray-300 tracking-tighter">{insurance.member_id}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Group ID</p>
                                        <p className="font-mono text-sm font-bold dark:text-gray-300 tracking-tighter">{insurance.group_id || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between relative z-10">
                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                                        <Clock size={12} className="text-emerald-500" />
                                        Sync: {insurance.last_verified_at ? new Date(insurance.last_verified_at).toLocaleDateString() : 'Pending'}
                                    </span>
                                    <button className="h-10 w-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Premium Privacy Banner */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-16 p-8 bg-gradient-to-br from-gray-900 to-emerald-950 rounded-[2.5rem] relative overflow-hidden shadow-2xl"
            >
                <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]" />
                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center text-emerald-400 shrink-0 border border-white/10">
                        <Shield size={36} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-white mb-2 tracking-tight">HIPAA Compliant Protection</h4>
                        <p className="text-emerald-100/60 font-medium leading-relaxed">
                            Your health data is handled securely to maintain privacy and security for your PHI.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default PatientInsurance;
