import React, { useState, useEffect } from 'react';
import { Download, FileText, Calendar, User, Pill, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';

const PatientPrescriptions = () => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const fetchPrescriptions = async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const response = await fetch(`/api/patients/${user.id}/prescriptions`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            const data = await response.json();
            setPrescriptions(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
        }
    };

    const downloadPDF = (prescription) => {
        const doc = new jsPDF();
        
        // PDF Header
        doc.setFontSize(22);
        doc.setTextColor(79, 70, 229); // Primary color
        doc.text('Medical Prescription', 20, 30);
        
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`Date: ${new Date(prescription.date_prescribed).toLocaleDateString()}`, 20, 40);
        doc.text(`Prescription ID: #PR-${prescription.id}`, 20, 45);

        // Doctor Info
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('Prescribed By:', 20, 60);
        doc.setFontSize(12);
        doc.text(`Dr. ${prescription.doctor_first_name} ${prescription.doctor_last_name}`, 20, 68);
        doc.text(`Specialty: ${prescription.specialty}`, 20, 74);

        // Medications
        doc.setFontSize(14);
        doc.text('Medications:', 20, 90);
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(prescription.medications, 170);
        doc.text(lines, 20, 98);

        // Instructions
        doc.setFontSize(14);
        doc.text('Instructions:', 20, 120);
        doc.setFontSize(11);
        const instructions = doc.splitTextToSize(prescription.instructions || 'Follow as directed.', 170);
        doc.text(instructions, 20, 128);

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('This is a computer-generated document.', 20, 280);

        doc.save(`Prescription_${prescription.id}.pdf`);
    };

    if (loading) return <div className="p-8 text-center text-slate-soft">Loading Prescriptions...</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-h1 font-bold text-secondary">My Prescriptions</h1>
                <p className="text-slate-soft text-h3 mt-1">Access and download your clinical history</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {prescriptions.length === 0 ? (
                    <div className="glass-card p-12 text-center text-slate-soft">
                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No prescriptions found in your history.</p>
                    </div>
                ) : (
                    prescriptions.map((p) => (
                        <div key={p.id} className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-primary/20 transition-all duration-300">
                            <div className="flex items-start gap-4">
                                <div className="p-4 bg-primary-light rounded-2xl text-primary transition-transform group-hover:scale-110">
                                    <Pill size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-secondary truncate max-w-[300px]">
                                        {p.medications.split('\n')[0]}
                                    </h3>
                                    <div className="flex flex-wrap gap-4 text-sm text-slate-soft">
                                        <div className="flex items-center gap-1.5">
                                            <User size={14} />
                                            <span>Dr. {p.doctor_first_name} {p.doctor_last_name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} />
                                            <span>{new Date(p.date_prescribed).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => downloadPDF(p)}
                                className="btn-secondary w-full md:w-auto flex items-center justify-center gap-2 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all shadow-sm"
                            >
                                <Download size={18} />
                                Download PDF
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PatientPrescriptions;
