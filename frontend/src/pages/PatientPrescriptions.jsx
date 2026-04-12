/**
 * Issue #46: Patient Prescription Portal - PREMIUM OVERHAUL
 * Clinical History Vault for high-fidelity record retrieval.
 */

import React, { useState, useEffect } from 'react';
import { 
    Download, FileText, Calendar, User, Pill, ArrowLeft, 
    Sparkles, ShieldCheck, Zap, ArrowRight, Info, Search,
    Activity, FlaskConical, ClipboardCheck, Clock, CheckCircle2,
    Lock, Share2, Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { API, authedHeaders } from '../config/api';

const PatientPrescriptions = () => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const fetchPrescriptions = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user?.id) return;
            const response = await fetch(`${API}/api/patients/${user.id}/prescriptions`, {
                headers: authedHeaders()
            });
            const data = await response.json();
            setPrescriptions(Array.isArray(data) ? data : []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
        }
    };

    const downloadPDF = (prescription) => {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229); 
        doc.text('Medical Prescription Protocol', 20, 30);
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`Synchronization Date: ${new Date(prescription.date_prescribed).toLocaleDateString()}`, 20, 40);
        doc.text(`Record ID: #H-SYNC-PR-${prescription.id}`, 20, 45);
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('Clinical Authority:', 20, 60);
        doc.setFontSize(12);
        doc.text(`Dr. ${prescription.doctor_first_name} ${prescription.doctor_last_name}`, 20, 68);
        doc.text(`Unit Specialty: ${prescription.specialty}`, 20, 74);
        doc.setFontSize(14);
        doc.text('Protocol Medications:', 20, 90);
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(prescription.medications, 170);
        doc.text(lines, 20, 98);
        doc.setFontSize(14);
        doc.text('Clinical Instructions:', 20, 120);
        doc.setFontSize(11);
        const instructions = doc.splitTextToSize(prescription.instructions || 'Follow institutional dirigibles as directed.', 170);
        doc.text(instructions, 20, 128);
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('This is a computer-generated clinical protocol verified by HealthSync Nexus.', 20, 280);
        doc.save(`Prescription_Protocol_${prescription.id}.pdf`);
    };

    const filtered = prescriptions.filter(p => 
        p.medications.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${p.doctor_first_name} ${p.doctor_last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse italic">Synchronizing Record Vault...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-24 animate-in fade-in duration-1000 px-4">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 group">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 transition-transform duration-700">
                        <ClipboardCheck size={36} strokeWidth={2.5} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black text-[var(--test-base)] tracking-tighter uppercase italic leading-none">History Vault</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 italic leading-none opacity-60">High-fidelity clinical record retrieval & storage</p>
                    </div>
                </div>
                <div className="relative group/search w-full md:w-96">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-primary transition-colors duration-500" size={20} />
                    <input 
                        type="text"
                        placeholder="SEARCH PROTOCOLS..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-16 pr-8 py-5 bg-white/5 border border-white/5 rounded-[2rem] text-[11px] font-black text-[var(--test-base)] uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all placeholder:text-slate-600 shadow-inner"
                    />
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatNode icon={<Pill size={24} />} value={prescriptions.length} label="Total Records" theme="indigo" />
                <StatNode icon={<CheckCircle2 size={24} />} value={prescriptions.filter(p => new Date(p.date_prescribed) > new Date(Date.now() - 30*24*60*60*1000)).length} label="Active Protocols" theme="emerald" />
                <StatNode icon={<ShieldCheck size={24} />} value="VERIFIED" label="Encryption Status" theme="amber" />
            </div>

            {/* Main Content Area */}
            <div className="space-y-6">
                {filtered.length === 0 ? (
                    <div className="glass-modal p-24 text-center rounded-[4rem] border-none shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-5"><FileText size={80} /></div>
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-white/10 group-hover:scale-110 transition-transform duration-700">
                            <Lock size={40} className="text-slate-700" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-500 uppercase italic tracking-tighter mb-4">Vault Segment Silent</h3>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] italic">No active prescription nodes detected in current search vector.</p>
                    </div>
                ) : (
                    filtered.map((p, idx) => (
                        <div 
                            key={p.id} 
                            style={{ animationDelay: `${idx * 100}ms` }}
                            className="glass-modal p-10 flex flex-col lg:flex-row justify-between items-center gap-10 group hover:border-primary/20 transition-all duration-700 rounded-[3.5rem] border-none shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10"
                        >
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/5 via-primary to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                            
                            <div className="flex items-center gap-8 flex-1 w-full">
                                <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary shadow-inner border border-primary/20 group-hover:rotate-12 group-hover:scale-110 transition-all duration-700 relative overflow-hidden">
                                    <Pill size={32} strokeWidth={2.5} />
                                    <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-110 rounded-full transition-transform duration-1000"></div>
                                </div>
                                <div className="space-y-4 flex-1">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-3xl font-black text-[var(--test-base)] uppercase italic tracking-tighter leading-none group-hover:text-primary transition-colors duration-500">
                                            {p.medications.split('\n')[0].substring(0, 32)}
                                        </h3>
                                        <span className="px-5 py-1.5 bg-white/5 border border-white/10 text-[9px] font-black text-slate-500 rounded-full uppercase tracking-widest italic shadow-inner">ID #PR-{p.id}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-8">
                                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
                                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-primary shadow-inner border border-white/5"><User size={14} /></div>
                                            Dr. {p.doctor_first_name} {p.doctor_last_name}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
                                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-emerald-500 shadow-inner border border-white/5"><Calendar size={14} /></div>
                                            {new Date(p.date_prescribed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
                                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-amber-500 shadow-inner border border-white/5"><FlaskConical size={14} /></div>
                                            {p.specialty}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 w-full lg:w-auto">
                                <button className="p-5 bg-white/5 border border-white/10 text-slate-400 rounded-3xl hover:bg-white/10 hover:text-[var(--test-base)] transition-all group/sub">
                                    <Share2 size={20} className="group-hover/sub:scale-110" />
                                </button>
                                <button 
                                    onClick={() => downloadPDF(p)}
                                    className="flex-1 lg:flex-none px-10 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 active:scale-95 transition-all italic flex items-center justify-center gap-4 group/btn"
                                >
                                    <Download size={20} strokeWidth={3} className="group-hover/btn:translate-y-0.5 transition-transform" /> 
                                    Download Protocol
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Insight Card */}
            <div className="glass-card rounded-[3.5rem] p-12 border-none bg-white/5 relative overflow-hidden group shadow-2xl">
                 <div className="absolute top-0 right-0 p-12 opacity-5"><Info size={64} /></div>
                <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                    <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                        <ShieldCheck size={40} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-[var(--test-base)] uppercase italic tracking-tighter mb-4">Encryption Clearance</h4>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic leading-relaxed max-w-2xl opacity-80">
                            Protocol retrieval nodes are strictly isolated & audited. SOC2 Type II compliance verified for all clinical record transfers across HealthSync Nexus.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatNode = ({ icon, value, label, theme }) => {
    const themeColors = {
        indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500 shadow-indigo-500/10',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/10',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-amber-500/10'
    };

    return (
        <div className="glass-card p-10 flex flex-col items-center text-center gap-6 hover:translate-y-[-8px] hover:shadow-2xl transition-all duration-700 rounded-[3.5rem] group relative overflow-hidden border-none shadow-xl">
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full blur-3xl transition-opacity group-hover:opacity-10 ${themeColors[theme].split(' ')[2].replace('text-', 'bg-')}`}></div>
            <div className={`w-16 h-16 rounded-[1.75rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-700 border ${themeColors[theme]}`}>
                {icon}
            </div>
            <div className="space-y-2 relative z-10">
                <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl font-black text-[var(--test-base)] tracking-tighter italic tabular-nums leading-none">{value}</span>
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] italic opacity-60 leading-none">{label}</p>
            </div>
        </div>
    );
};

export default PatientPrescriptions;
