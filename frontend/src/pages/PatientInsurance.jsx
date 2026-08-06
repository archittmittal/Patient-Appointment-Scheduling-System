import { useState, useEffect, Suspense, lazy } from 'react';
import { Shield, Camera, Plus, ChevronRight, Clock, X, Loader2, DollarSign, Calendar } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState('policies'); // 'policies' or 'claims'

    // Claims state variables
    const [claimsList, setClaimsList] = useState([]);
    const [claimsLoading, setClaimsLoading] = useState(false);
    const [showClaimForm, setShowClaimForm] = useState(false);
    const [claimFormData, setClaimFormData] = useState({
        patientInsuranceId: '',
        amountBilled: ''
    });
    const [submittingClaim, setSubmittingClaim] = useState(false);

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

    const fetchClaims = async () => {
        setClaimsLoading(true);
        try {
            const data = await apiClient.get('/api/insurance/claims/my');
            setClaimsList(data && !data.error ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setClaimsLoading(false);
        }
    };

    useEffect(() => {
        fetchInsurance();
    }, []);

    useEffect(() => {
        if (activeTab === 'claims') {
            fetchClaims();
        }
    }, [activeTab]);

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

    const handleClaimSubmit = async (e) => {
        e.preventDefault();
        if (!claimFormData.patientInsuranceId || !claimFormData.amountBilled) return;

        const billed = parseFloat(claimFormData.amountBilled);
        if (isNaN(billed) || !isFinite(billed) || billed <= 0) {
            alert('Billed amount must be a positive number');
            return;
        }

        setSubmittingClaim(true);
        try {
            const res = await apiClient.post('/api/insurance/claims', {
                patientInsuranceId: parseInt(claimFormData.patientInsuranceId),
                amountBilled: billed
            });
            if (res && !res.error) {
                fetchClaims();
                setShowClaimForm(false);
                setClaimFormData({ patientInsuranceId: '', amountBilled: '' });
            } else {
                alert(res?.message || res?.error || 'Failed to submit claim');
            }
        } catch (err) {
            console.error(err);
            alert(err.message || 'Failed to submit claim');
        } finally {
            setSubmittingClaim(false);
        }
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
                    <p className="text-gray-500 font-medium">Manage your digital health wallet and track billing claims history.</p>
                </motion.div>
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-wrap gap-4"
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
                    {insuranceList.length > 0 && (
                        <button 
                            onClick={() => setShowClaimForm(true)}
                            className="flex items-center gap-3 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 transform hover:-translate-y-1 active:scale-95"
                        >
                            <DollarSign size={20} />
                            Submit Claim
                        </button>
                    )}
                </motion.div>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl mb-10 w-full sm:w-80 border border-gray-200/50">
                <button
                    onClick={() => setActiveTab('policies')}
                    className={`flex-1 py-3 text-sm font-black rounded-xl transition-all duration-300 ${activeTab === 'policies' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-md shadow-gray-200/30' : 'text-gray-500'}`}
                >
                    Policies
                </button>
                <button
                    onClick={() => setActiveTab('claims')}
                    className={`flex-1 py-3 text-sm font-black rounded-xl transition-all duration-300 ${activeTab === 'claims' ? 'bg-white dark:bg-gray-700 text-emerald-600 shadow-md shadow-gray-200/30' : 'text-gray-500'}`}
                >
                    Claims History
                </button>
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

                {showClaimForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowClaimForm(false)}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 p-8 z-10 animate-in fade-in zoom-in duration-300"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-black dark:text-white tracking-tight">Submit Claim</h3>
                                <button onClick={() => setShowClaimForm(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <form onSubmit={handleClaimSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Coverage Policy</label>
                                    <select
                                        value={claimFormData.patientInsuranceId}
                                        onChange={(e) => setClaimFormData({...claimFormData, patientInsuranceId: e.target.value})}
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-805 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none font-bold dark:text-white appearance-none cursor-pointer"
                                        required
                                    >
                                        <option value="">Choose policy...</option>
                                        {insuranceList.map(ins => (
                                            <option key={ins.id} value={ins.id}>{ins.provider_name} (ID: {ins.member_id})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Billed Amount ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={claimFormData.amountBilled}
                                        onChange={(e) => setClaimFormData({...claimFormData, amountBilled: e.target.value})}
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-805 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none font-bold dark:text-white"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submittingClaim}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-indigo-500/40 transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submittingClaim ? 'SUBMITTING...' : 'SUBMIT CLAIM REQUEST'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {activeTab === 'policies' ? (
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
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Claims History</h3>
                        </div>
                    </div>

                    {claimsLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-indigo-500" size={48} />
                        </div>
                    ) : claimsList.length === 0 ? (
                        <div className="bg-gray-50/50 dark:bg-gray-900/40 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-16 text-center">
                            <div className="w-20 h-20 bg-white dark:bg-gray-800 text-gray-300 dark:text-gray-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                                <DollarSign size={40} />
                            </div>
                            <h4 className="text-2xl font-black dark:text-white mb-3 tracking-tight">No Claims Logged</h4>
                            <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">You haven't submitted any insurance claims yet. Submit one dynamically whenever care services occur.</p>
                            {insuranceList.length > 0 && (
                                <button 
                                    onClick={() => setShowClaimForm(true)}
                                    className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-500/20 transform hover:-translate-y-1 active:scale-95"
                                >
                                    <DollarSign size={20} />
                                    Submit First Claim
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 dark:bg-gray-800/30 text-[10px] text-gray-400 uppercase font-black tracking-[0.2em]">
                                        <tr>
                                            <th className="px-8 py-5">Carrier</th>
                                            <th className="px-8 py-5">Billed Amount</th>
                                            <th className="px-8 py-5">Covered Amount</th>
                                            <th className="px-8 py-5">Status</th>
                                            <th className="px-8 py-5">Date Submitted</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                        {claimsList.map(claim => (
                                            <tr key={claim.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850 transition-colors">
                                                <td className="px-8 py-5 font-black text-gray-950 dark:text-white">{claim.provider_name}</td>
                                                <td className="px-8 py-5 font-mono font-bold text-gray-700 dark:text-gray-300">${parseFloat(claim.amount_billed).toFixed(2)}</td>
                                                <td className="px-8 py-5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                    {claim.amount_covered !== null ? `$${parseFloat(claim.amount_covered).toFixed(2)}` : '—'}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                        claim.status === 'APPROVED' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                                        claim.status === 'REJECTED' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                                        'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                                    }`}>
                                                        {claim.status}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-xs text-gray-400 flex items-center gap-2 mt-1 border-none">
                                                    <Calendar size={14} className="text-gray-300" />
                                                    {new Date(claim.submitted_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

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
