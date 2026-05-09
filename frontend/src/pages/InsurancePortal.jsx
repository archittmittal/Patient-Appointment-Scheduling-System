import React, { useState, useEffect } from 'react';
import { Shield, Users, CheckCircle, Clock, AlertCircle, Search, Filter, ArrowUpRight, BarChart3, Database, RefreshCw, X, Plus } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import InsuranceForm from '../components/InsuranceForm';

const InsurancePortal = () => {
    const [stats, setStats] = useState(null);
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [showAddModal, setShowAddModal] = useState(false);
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState('');

    const fetchPatients = async () => {
        try {
            const data = await apiClient.get('/api/admin/patients/list');
            if (data && !data.error) setPatients(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchData = async () => {
        try {
            const [statsRes, policiesRes] = await Promise.all([
                apiClient.get('/api/insurance/stats'),
                apiClient.get('/api/insurance/all')
            ]);
            if (statsRes && !statsRes.error) setStats(statsRes);
            if (policiesRes && !policiesRes.error) setPolicies(policiesRes);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchPatients();
    }, []);

    const handleVerify = async (id) => {
        try {
            const data = await apiClient.post(`/api/insurance/verify/${id}`, {});
            if (data && !data.error) fetchData();
            else alert(data?.error || 'Verification failed');
        } catch (err) {
            console.error(err);
            alert('Verification failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this insurance record?')) return;
        try {
            const data = await apiClient.delete(`/api/insurance/${id}`);
            if (data && !data.error) fetchData();
            else alert(data?.error || 'Delete failed');
        } catch (err) {
            console.error(err);
            alert('Delete failed');
        }
    };

    const filteredPolicies = policies.filter(p => {
        const matchesSearch = p.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.member_id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'ALL' || p.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-10 px-4 pb-20">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-8 bg-emerald-600 rounded-full" />
                        <h1 className="text-4xl font-black tracking-tight dark:text-white">Global Insurance Core</h1>
                    </div>
                    <p className="text-gray-500 font-medium">Enterprise-grade monitoring of policy verifications and network health.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black transition-all shadow-lg hover:shadow-emerald-500/25 transform hover:-translate-y-1 active:scale-95"
                    >
                        <Plus size={20} />
                        Manual Enrollment
                    </button>
                    <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-md px-6 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-black flex items-center gap-3 shadow-sm">
                        <Shield size={20} className="text-emerald-600" />
                        PORTAL ACTIVE
                    </div>
                </div>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Managed Policies', value: policies.length, icon: Database, color: 'emerald', growth: '+12.5%' },
                    { label: 'Verified Integrity', value: stats?.byStatus.find(s => s.status === 'VERIFIED')?.count || 0, icon: CheckCircle, color: 'green', growth: '99.9%' },
                    { label: 'Pending Assessment', value: stats?.byStatus.find(s => s.status === 'PENDING')?.count || 0, icon: Clock, color: 'amber', growth: '-4%' },
                    { label: 'Carrier Partnerships', value: stats?.byProvider.length, icon: BarChart3, color: 'teal', growth: 'Stable' }
                ].map((stat, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 group relative overflow-hidden"
                    >
                        <div className={`absolute -right-8 -top-8 w-32 h-32 bg-${stat.color}-500/5 rounded-full blur-3xl group-hover:bg-${stat.color}-500/10 transition-colors`} />
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className={`p-4 bg-${stat.color}-500/10 text-${stat.color}-600 rounded-[1.25rem] shadow-inner`}>
                                <stat.icon size={24} />
                            </div>
                            <span className={`text-xs font-black tracking-widest uppercase ${stat.growth.startsWith('+') || stat.growth === '99.9%' ? 'text-green-500' : 'text-amber-500'}`}>
                                {stat.growth}
                            </span>
                        </div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">{stat.label}</p>
                        <h3 className="text-3xl font-black dark:text-white tracking-tighter relative z-10">{stat.value}</h3>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Advanced Policy Table */}
                <div className="lg:col-span-2 space-y-6">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
                    >
                        <div className="p-10 border-b border-gray-50 dark:border-gray-800 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                            <h3 className="font-black text-2xl dark:text-white tracking-tight">Policy Inventory</h3>
                            <div className="flex flex-wrap gap-4">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
                                    <input 
                                        type="text" 
                                        placeholder="Search by name or ID..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-12 pr-6 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none dark:text-white w-full sm:w-72 transition-all"
                                    />
                                </div>
                                <select 
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-6 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm font-bold outline-none dark:text-white focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="ALL">Status: All</option>
                                    <option value="VERIFIED">Status: Verified</option>
                                    <option value="PENDING">Status: Pending</option>
                                    <option value="EXPIRED">Status: Expired</option>
                                </select>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 dark:bg-gray-800/30 text-[10px] text-gray-400 uppercase font-black tracking-[0.2em]">
                                    <tr>
                                        <th className="px-10 py-6">Patient Identity</th>
                                        <th className="px-10 py-6">Carrier</th>
                                        <th className="px-10 py-6">Member ID</th>
                                        <th className="px-10 py-6">Integrity</th>
                                        <th className="px-10 py-6 text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {filteredPolicies.map((policy, i) => (
                                        <tr key={policy.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-all duration-300">
                                            <td className="px-10 py-7">
                                                <div className="font-black dark:text-white text-lg tracking-tight group-hover:text-emerald-600 transition-colors">{policy.patient_name}</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">UID: {policy.patient_id}</div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    <span className="font-bold dark:text-gray-300">{policy.provider_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <span className="font-mono text-sm font-black dark:text-gray-400 tracking-tighter bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg">{policy.member_id}</span>
                                            </td>
                                            <td className="px-10 py-7">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                                    policy.status === 'VERIFIED' ? 'bg-green-500 text-white' :
                                                    policy.status === 'EXPIRED' ? 'bg-red-500 text-white' :
                                                    'bg-amber-500 text-white'
                                                }`}>
                                                    {policy.status}
                                                </span>
                                            </td>
                                            <td className="px-10 py-7 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleVerify(policy.id)}
                                                        className="h-10 w-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all duration-300"
                                                        title="Re-verify"
                                                    >
                                                        <RefreshCw size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(policy.id)}
                                                        className="h-10 w-10 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-600 hover:text-white transition-all duration-300"
                                                        title="Delete"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>

                {/* Performance Analytics Column */}
                <div className="space-y-10">
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white dark:bg-gray-900 p-10 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm"
                    >
                        <h3 className="font-black text-xl mb-8 dark:text-white tracking-tight">Market Penetration</h3>
                        <div className="space-y-8">
                            {stats?.byProvider.map((p) => (
                                <div key={p.name} className="space-y-3">
                                    <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                                        <span className="dark:text-gray-400">{p.name}</span>
                                        <span className="dark:text-white">{p.count} Policies</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner p-[2px]">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(p.count / policies.length) * 100}%` }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-gray-900 to-emerald-950 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
                        <h3 className="font-black text-xl mb-8 text-white tracking-tight relative z-10">Live Signal Feed</h3>
                        <div className="space-y-6 relative z-10">
                            {stats?.recentVerifications.map((v, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className={`w-1.5 h-12 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${v.status === 'VERIFIED' ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div className="flex-1">
                                        <div className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">{v.patient_name}</div>
                                        <div className="text-[10px] font-black text-emerald-300/50 uppercase tracking-widest mt-1">{v.provider_name} • {new Date(v.last_verified_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddModal(false)}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
                        >
                            <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                                        <Plus size={24} />
                                    </div>
                                    <h2 className="text-2xl font-black dark:text-white tracking-tight">Manual Policy Enrollment</h2>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <div className="p-8 max-h-[70vh] overflow-y-auto">
                                <div className="mb-8 space-y-3">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Select Patient</label>
                                    <select 
                                        value={selectedPatientId}
                                        onChange={(e) => setSelectedPatientId(e.target.value)}
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none dark:text-white font-bold transition-all appearance-none"
                                    >
                                        <option value="">Choose a Patient...</option>
                                        {patients.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedPatientId && (
                                    <InsuranceForm 
                                        patientId={selectedPatientId} 
                                        onSuccess={() => {
                                            setShowAddModal(false);
                                            fetchData();
                                            setSelectedPatientId('');
                                        }} 
                                    />
                                )}
                                
                                {!selectedPatientId && (
                                    <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl">
                                        <Users className="mx-auto text-gray-300 mb-4" size={48} />
                                        <p className="text-gray-400 font-bold">Please select a patient to continue enrollment.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default InsurancePortal;
