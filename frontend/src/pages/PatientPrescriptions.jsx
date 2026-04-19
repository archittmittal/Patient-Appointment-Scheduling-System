import React, { useState, useEffect } from 'react';
import { 
    Download, FileText, Calendar, User, Pill, 
    Search, Activity, FlaskConical, ClipboardCheck, 
    CheckCircle2, Info, Share2, Printer, ChevronRight, ShieldCheck
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
            const userStr = localStorage.getItem('user');
            if (!userStr) return;
            const user = JSON.parse(userStr);
            if (!user?.id) return;
            
            const response = await fetch(`${API}/api/patients/${user.id}/prescriptions`, {
                headers: authedHeaders()
            });
            const data = await response.json();
            setPrescriptions(Array.isArray(data) ? data : []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            setLoading(false);
        }
    };

    const downloadPDF = (prescription) => {
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(29, 29, 31); 
        doc.text('Prescription Record', 20, 30);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`Date: ${new Date(prescription.date_prescribed).toLocaleDateString()}`, 20, 42);
        doc.text(`ID: #PR-${prescription.id}`, 20, 48);
        
        doc.setFontSize(14);
        doc.setTextColor(29, 29, 31);
        doc.text('Doctor Information:', 20, 65);
        
        doc.setFontSize(12);
        doc.text(`Dr. ${prescription.doctor_first_name} ${prescription.doctor_last_name}`, 20, 73);
        doc.text(`Specialty: ${prescription.specialty}`, 20, 79);
        
        doc.setFontSize(14);
        doc.text('Medications:', 20, 95);
        
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(prescription.medications, 170);
        doc.text(lines, 20, 103);
        
        doc.setFontSize(14);
        doc.text('Instructions:', 20, 130);
        
        doc.setFontSize(11);
        const instructions = doc.splitTextToSize(prescription.instructions || 'Follow as directed by your physician.', 170);
        doc.text(instructions, 20, 138);
        
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('This record was generated from your Patient Portal.', 20, 280);
        
        doc.save(`Prescription_${prescription.id}.pdf`);
    };

    const filtered = prescriptions.filter(p => 
        p.medications.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${p.doctor_first_name} ${p.doctor_last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-20 space-y-4">
             <Activity className="text-primary animate-pulse" size={48} />
             <p className="text-sm font-medium text-slate-500 tracking-wide">Loading your prescriptions...</p>
        </div>
    );

    return (
        <div className="section-container space-y-12 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Prescriptions</h1>
                    <p className="text-slate-500">View and manage your current and past medication records.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Search medications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field pl-11 py-2.5 bg-white shadow-sm border border-slate-100"
                    />
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    icon={<Pill size={24} className="text-indigo-500" />} 
                    value={prescriptions.length} 
                    label="Total Records" 
                    color="indigo" 
                />
                <StatCard 
                    icon={<CheckCircle2 size={24} className="text-emerald-500" />} 
                    value={prescriptions.filter(p => new Date(p.date_prescribed) > new Date(Date.now() - 30*24*60*60*1000)).length} 
                    label="Recent Records" 
                    color="emerald" 
                />
                <StatCard 
                    icon={<ShieldCheck size={24} className="text-amber-500" />} 
                    value="Secure" 
                    label="Portal Access" 
                    color="amber" 
                />
            </div>

            {/* Prescription List */}
            <div className="space-y-4">
                {filtered.length === 0 ? (
                    <div className="apple-card p-16 text-center border-dashed border-2 border-slate-100 bg-transparent">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <ClipboardCheck size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-500 mb-1">No prescriptions found</h3>
                        <p className="text-sm text-slate-400">Try adjusting your search or check back later.</p>
                    </div>
                ) : (
                    filtered.map((p) => (
                        <div 
                            key={p.id} 
                            className="apple-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-6 flex-1 w-full">
                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0">
                                    <Pill size={28} />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold tracking-tight text-slate-900 leading-none">
                                            {p.medications.split('\n')[0].substring(0, 40)}
                                        </h3>
                                        <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold text-slate-500 rounded-md">#PR-{p.id}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                            <User size={14} className="text-slate-400" />
                                            Dr. {p.doctor_first_name} {p.doctor_last_name}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                            <Calendar size={14} className="text-slate-400" />
                                            {new Date(p.date_prescribed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                                            <FlaskConical size={14} className="text-indigo-400" />
                                            {p.specialty}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => downloadPDF(p)}
                                    className="flex-1 md:flex-none btn-primary py-2.5 px-8 shadow-sm hover:shadow-md"
                                >
                                    <Download size={18} /> 
                                    Download
                                </button>
                                <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-all">
                                    <Printer size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Bottom Insight Card */}
            <div className="apple-card p-8 border-none bg-primary-light flex items-center gap-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                    <Info size={24} />
                </div>
                <div>
                    <h4 className="text-lg font-bold mb-1">Medication Safety</h4>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                        Always follow the instructions provided by your doctor. If you experience any unexpected symptoms or have questions about your prescription, please contact your healthcare provider immediately.
                    </p>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, value, label, color }) => {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        amber: 'bg-amber-50 text-amber-600'
    };

    return (
        <div className="apple-card p-6 hover:shadow-md transition-all duration-300">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colors[color]}`}>
                {icon}
            </div>
            <div className="space-y-0.5">
                <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
        </div>
    );
};

export default PatientPrescriptions;
