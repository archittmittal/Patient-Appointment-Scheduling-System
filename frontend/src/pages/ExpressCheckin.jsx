/**
 * Issue #45: Express Check-in Page - PREMIUM OVERHAUL
 * High-fidelity fast-track experience for verified clinical entry.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    QrCode, Zap, CheckCircle2, Clock, User, Calendar, 
    ChevronRight, Sparkles, Shield, Award, ArrowRight,
    Smartphone, ScanLine, Timer, MapPin, Copy, Activity,
    ShieldCheck, Fingerprint, Search, Info
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';

const ExpressBadge = ({ eligible }) => (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
        eligible 
            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner'
            : 'bg-white/5 text-slate-600 border border-white/5'
    }`}>
        {eligible ? (
            <>
                <Zap size={10} className="animate-pulse" />
                Express Protocol Active
            </>
        ) : (
            <>Standard Sync Only</>
        )}
    </span>
);

const QRCodeDisplay = ({ qrData, onClose }) => {
    const [copied, setCopied] = useState(false);
    if (!qrData) return null;

    const handleCopy = () => {
        if (qrData.token) {
            navigator.clipboard.writeText(qrData.token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-500">
            <div className="glass-modal rounded-[3.5rem] p-10 max-w-sm w-full border-none shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="text-center mb-10 relative z-10">
                    <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-inner">
                        <QrCode className="text-primary" size={28} />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Secure Credential</h3>
                    <p className="text-[10px] font-black text-slate-500 mt-2 uppercase tracking-[0.3em]">Scan at Clinical Kiosk Station</p>
                </div>
                
                <div className="bg-white rounded-[2.5rem] p-8 mb-8 border border-white/10 flex items-center justify-center shadow-inner relative group">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]"></div>
                    <QRCodeSVG 
                        value={qrData.qrData || qrData.token || 'invalid'} 
                        size={200}
                        level="H"
                        includeMargin={true}
                        className="bg-white rounded-[1.5rem] relative z-10 p-2"
                    />
                     <ScanLine className="absolute top-1/2 left-0 w-full text-primary/20 animate-bounce pointer-events-none" size={40} />
                </div>

                <div className="flex items-center justify-center mb-8 gap-3 relative z-10">
                    <p className="text-[9px] text-slate-500 font-black bg-white/5 px-4 py-2 rounded-xl border border-white/10 uppercase tracking-widest">
                        {qrData.token?.slice(0, 12)}...
                    </p>
                    <button 
                        onClick={handleCopy}
                        className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-500 hover:text-primary transition-all active:scale-95"
                    >
                        {copied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8 relative z-10">
                    <p className="text-[9px] font-black text-amber-600 text-center uppercase tracking-widest flex items-center justify-center gap-2">
                        <Timer size={14} className="animate-spin-slow" />
                        Credential TTL: 24H Calibration
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-all"
                >
                    Secure Close
                </button>
            </div>
        </div>
    );
};

const SuccessScreen = ({ result, onViewQueue, onDashboard }) => (
    <div className="text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-[2.5rem] animate-ping" />
            <div className="absolute inset-0 bg-emerald-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-emerald-500/40 border border-emerald-400/20 relative z-10">
                <ShieldCheck size={48} strokeWidth={2.5} />
            </div>
        </div>
        
        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Identity Synchronized</h1>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-12">{result.message}</p>

        <div className="glass-card rounded-[3.5rem] p-10 mb-12 border-none shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={64} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] shadow-inner">
                    <p className="text-5xl font-black text-primary tracking-tight tabular-nums">#{result.queuePosition}</p>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-4">Registry Position</p>
                </div>
                <div className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] shadow-inner">
                    <p className="text-5xl font-black text-primary tracking-tight tabular-nums">
                        {result.estimatedWaitMins || '15'}
                        <span className="text-xl font-black text-slate-600 ml-1">M</span>
                    </p>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-4">Estimated Latency</p>
                </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-center gap-3 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                <Clock size={14} className="text-primary animate-pulse" />
                Verified at {new Date(result.checkinTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} Telemetry
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 max-w-lg mx-auto">
            <button
                onClick={onViewQueue}
                className="flex-1 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
            >
                Live Queue Stream <ArrowRight size={16} className="animate-pulse" />
            </button>
            <button
                onClick={onDashboard}
                className="flex-1 py-5 bg-white/5 text-slate-400 border border-white/5 font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] hover:bg-white/10 transition-all"
            >
                Registry Home
            </button>
        </div>
    </div>
);

const AppointmentCard = ({ appointment, onOneTap, onGenerateQR, isLoading }) => (
    <div className="glass-card rounded-[3rem] border border-white/5 overflow-hidden hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-700 group relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={48} /></div>
        <div className="p-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
                        <User size={24} strokeWidth={2.5} />
                    </div>
                    <div className="text-center md:text-left">
                        <h4 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Dr. {appointment.doctor}</h4>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{appointment.specialty} • Station B-12</p>
                    </div>
                </div>
                <ExpressBadge eligible={appointment.isExpressEligible} />
            </div>

            <div className="flex items-center justify-center md:justify-start gap-8 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 px-2">
                <div className="flex items-center gap-3">
                    <Clock size={16} className="text-primary opacity-60" />
                    <span>Sync: {appointment.time}</span>
                </div>
                {appointment.previousVisits > 0 && (
                    <div className="flex items-center gap-3">
                        <Award size={16} className="text-amber-500 opacity-60" />
                        <span>{appointment.previousVisits} Completed Cycles</span>
                    </div>
                )}
            </div>

            {appointment.isExpressEligible ? (
                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={() => onOneTap(appointment.id)}
                        disabled={isLoading}
                        className="flex-[2] py-5 bg-emerald-500 text-white rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all disabled:opacity-50"
                    >
                        {isLoading ? <Activity size={16} className="animate-spin" /> : <><Zap size={18} /> Instant Sync</>}
                    </button>
                    <button
                        onClick={() => onGenerateQR(appointment.id)}
                        disabled={isLoading}
                        className="flex-1 py-5 bg-white/5 border border-white/5 text-slate-500 hover:text-primary hover:border-primary/40 rounded-[1.75rem] transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                        <QrCode size={20} />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => onGenerateQR(appointment.id)}
                    disabled={isLoading}
                    className="w-full py-5 bg-white/5 border border-white/5 text-slate-500 hover:text-primary hover:border-primary/40 rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                >
                    <QrCode size={18} />
                    Holographic Credential
                </button>
            )}
        </div>
    </div>
);

const ExpressCheckin = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [appointments, setAppointments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [qrData, setQrData] = useState(null);
    const [success, setSuccess] = useState(null);
    const [prefilledInfo, setPrefilledInfo] = useState(null);

    useEffect(() => {
        if (!user?.id) return;
        const fetchData = async () => {
            try {
                const [aptData, infoData] = await Promise.all([
                    apiClient.get('/api/express-checkin/today'),
                    apiClient.get('/api/express-checkin/prefilled-info')
                ]);
                if (aptData && !aptData.error) setAppointments(Array.isArray(aptData) ? aptData : []);
                if (infoData && !infoData.error) setPrefilledInfo(infoData);
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        fetchData();
    }, [user?.id]);

    const handleOneTap = async (appointmentId) => {
        setActionLoading(true);
        try {
            const data = await apiClient.post(`/api/express-checkin/one-tap/${appointmentId}`, {});
            if (data.error) throw new Error(data.error);
            setSuccess(data);
        } catch (err) { alert(err.message); } finally { setActionLoading(false); }
    };

    const handleGenerateQR = async (appointmentId) => {
        setActionLoading(true);
        try {
            const data = await apiClient.post(`/api/express-checkin/generate-token/${appointmentId}`, {});
            if (data.error) throw new Error(data.error);
            setQrData(data);
        } catch (err) { alert(err.message); } finally { setActionLoading(false); }
    };

    if (isLoading) return <div className="p-20 text-center text-slate-500 font-black uppercase tracking-[0.2em] animate-pulse">Initializing Entry Terminal...</div>;

    if (success) {
        return (
            <div className="max-w-xl mx-auto pt-10 pb-20 px-4">
                <SuccessScreen 
                    result={success}
                    onViewQueue={() => navigate('/live-queue')}
                    onDashboard={() => navigate('/patient-dashboard')}
                />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto pb-20 px-4 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-[2rem] flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-inner">
                        <Zap size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase leading-none mb-3 text-emerald-600">Entry Terminal</h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">Fast-track telemetry for verified practitioners</p>
                    </div>
                </div>
            </div>

            {/* Loyalty Node */}
            {prefilledInfo?.hasHistory && (
                <div className="bg-primary rounded-[3rem] p-10 mb-12 relative overflow-hidden group shadow-2xl shadow-primary/20">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all duration-1000"></div>
                    <div className="flex items-center gap-8 relative z-10">
                        <div className="p-5 bg-white/10 backdrop-blur-md rounded-[2rem] text-white border border-white/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                            <Fingerprint size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tight uppercase mb-2">Authenticated Interface: {user?.first_name}</h3>
                            <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.4em] leading-relaxed">
                                Registry Status: Legacy Patient • {prefilledInfo.totalVisits || 0} Successful Cycles
                            </p>
                        </div>
                        <div className="ml-auto hidden xl:block opacity-20"><Shield size={64} /></div>
                    </div>
                </div>
            )}

            {/* Entry Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <FeatureMetric icon={Zap} color="emerald" title="Instant Sync" desc="Zero-latency bypass for legacy patients." />
                <FeatureMetric icon={QrCode} color="primary" title="Holographic ID" desc="Kiosk credentialing via secure tokenization." />
            </div>

            {/* Active Cycles */}
            <div className="mb-12">
                <div className="flex items-center gap-4 mb-8 px-2">
                    <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-600"><Calendar size={16} /></div>
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em]">Active Meridian Cycles</h2>
                </div>

                {appointments.length > 0 ? (
                    <div className="space-y-6">
                        {appointments.map((apt) => (
                            <AppointmentCard
                                key={apt.id}
                                appointment={apt}
                                onOneTap={handleOneTap}
                                onGenerateQR={handleGenerateQR}
                                isLoading={actionLoading}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-24 text-center glass-modal rounded-[3.5rem] border-none shadow-2xl">
                        <Calendar size={64} className="text-slate-700/20 mx-auto mb-8" />
                        <h3 className="text-xl font-black text-slate-500 uppercase tracking-tight mb-4">Registry Clear</h3>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-10">No cycles detected for the current meridian window.</p>
                        <button
                            onClick={() => navigate('/book')}
                            className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-[1.75rem] shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-4 mx-auto"
                        >
                            Sync New Appointment <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Protocol Manual */}
            <div className="glass-card rounded-[3.5rem] p-10 border-[var(--border-base)] relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Info size={48} /></div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-10 px-2">Protocol Specifications</h3>
                <div className="space-y-8">
                    <ProtocolStep num="1" title="Legacy Detection" desc="The system automatically identifies practitioners with established clinical signatures." />
                    <ProtocolStep num="2" title="Credential Extraction" desc="Generate a secure holographic QR token or bypass via one-tap telemetry." />
                    <ProtocolStep num="3" title="Registry Optimization" desc="Automatically indexed into the live queue with minimized arrival latency." />
                </div>
            </div>

            {/* QR Modal Overlay */}
            <QRCodeDisplay qrData={qrData} onClose={() => setQrData(null)} />
        </div>
    );
};

const FeatureMetric = ({ icon: Icon, color, title, desc }) => (
    <div className="glass-card p-6 rounded-[2.5rem] border-[var(--border-base)] group hover:border-white/10 transition-all duration-700 relative overflow-hidden">
        <div className="flex items-center gap-5">
            <div className={`p-4 bg-${color}-500/10 text-${color}-500 rounded-2xl border border-${color}-500/20 shadow-inner group-hover:rotate-12 transition-transform duration-700`}>
                <Icon size={20} strokeWidth={2.5} />
            </div>
            <div>
                <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight block mb-1">{title}</span>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-60">{desc}</p>
            </div>
        </div>
    </div>
);

const ProtocolStep = ({ num, title, desc }) => (
    <div className="flex items-start gap-8 group">
        <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-[1.25rem] flex items-center justify-center text-primary font-black text-sm shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-700 flex-shrink-0">
            {num}
        </div>
        <div>
            <h4 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest mb-2">{title}</h4>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed opacity-60">{desc}</p>
        </div>
    </div>
);

export default ExpressCheckin;
