import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle,
    Activity, Award, Download, Search, Users, Stethoscope,
    ChevronLeft, Calendar, FileSpreadsheet, CheckCircle, Percent,
    Database, Tag
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

const AdminAnalytics = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState(30); // 7, 30, 90 days
    const [searchTerm, setSearchTerm] = useState('');
    const [downloadingCsv, setDownloadingCsv] = useState(false);

    // Symptom Checker Telemetry states
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'symptoms'
    const [symptomStats, setSymptomStats] = useState(null);
    const [loadingSymptomStats, setLoadingSymptomStats] = useState(false);
    const [telemetrySearch, setTelemetrySearch] = useState('');

    useEffect(() => {
        if (!user || user.role !== 'ADMIN') return;
        
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const data = await apiClient.get(`/api/analytics/clinic?days=${timeframe}`);
                if (data && !data.error) {
                    setAnalytics(data);
                }
            } catch (err) {
                console.error('Failed to load clinic analytics:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [user, timeframe]);

    useEffect(() => {
        if (!user || user.role !== 'ADMIN' || activeTab !== 'symptoms') return;
        
        const fetchSymptomStats = async () => {
            setLoadingSymptomStats(true);
            try {
                const data = await apiClient.get('/api/symptom-checker/admin-stats');
                if (data && !data.error) {
                    setSymptomStats(data);
                }
            } catch (err) {
                console.error('Failed to load symptom stats:', err);
            } finally {
                setLoadingSymptomStats(false);
            }
        };

        fetchSymptomStats();
    }, [user, activeTab]);

    const getSpecialtyBadgeStyle = (spec) => {
        switch (spec) {
            case 'Cardiologist':
                return 'bg-indigo-50 border-indigo-200/50 text-indigo-600';
            case 'Dermatologist':
                return 'bg-emerald-50 border-emerald-200/50 text-emerald-600';
            default:
                return 'bg-amber-50 border-amber-200/50 text-amber-600';
        }
    };

    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-[1.5rem] flex items-center justify-center mb-6">
                    <AlertTriangle size={32} />
                </div>
                <h1 className="text-2xl font-black text-rose-500 tracking-widest uppercase mb-2">Access Denied</h1>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Matrix Protocols Require Administrative Credentials</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-[85vh] flex flex-col items-center justify-center p-20 space-y-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-xs font-black text-slate-500 tracking-[0.2em] uppercase animate-pulse">Syncing Clinic Intelligence Core...</p>
            </div>
        );
    }

    const {
        hourlyStats = [],
        departmentStats = [],
        revenueStats = { totalRevenue: 0, revenueByDay: [], revenueByDoctor: [] },
        cancellationStats = { cancellationRate: 0, totalAppointments: 0, totalCancellations: 0, cancellationsByDay: [] },
        utilizationStats = { avgWaitMins: 0, avgDurationMins: 0, doctorPerformance: [] }
    } = analytics || {};

    // Colors for the Pie Chart
    const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#f43f5e'];

    // Map doctor revenue to the performance table data
    const performanceData = utilizationStats.doctorPerformance.map(dp => {
        const revDoc = revenueStats.revenueByDoctor.find(r => r.doctorId === dp.doctorId);
        return {
            ...dp,
            revenue: revDoc ? revDoc.revenue : 0,
            paidAppointments: revDoc ? revDoc.paidAppointments : 0
        };
    });

    // Filter performance grid by doctor name or specialty
    const filteredPerformance = performanceData.filter(dp => 
        dp.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dp.specialty.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Export CSV report
    const exportCSV = () => {
        setDownloadingCsv(true);
        try {
            let csvContent = '';
            
            if (activeTab === 'overview') {
                // File Header / Metadata
                csvContent += 'CLINIC INTELLIGENCE HUB REPORT\n';
                csvContent += `Generated On,${new Date().toISOString()}\n`;
                csvContent += `Timeframe,Last ${timeframe} Days\n\n`;

                // Section 1: Overview KPIs
                csvContent += 'SYSTEM OVERVIEW KEY PERFORMANCE INDICATORS\n';
                csvContent += 'Metric,Value\n';
                csvContent += `Total Revenue (INR),${revenueStats.totalRevenue}\n`;
                csvContent += `Average Patient Wait (mins),${utilizationStats.avgWaitMins}\n`;
                csvContent += `Cancellation Rate (%),${cancellationStats.cancellationRate}%\n`;
                csvContent += `Total Bookings,${cancellationStats.totalAppointments}\n`;
                csvContent += `Total Cancellations,${cancellationStats.totalCancellations}\n\n`;

                // Section 2: Daily Performance Timeline
                csvContent += 'DAILY PERFORMANCE TIMELINE\n';
                csvContent += 'Date,Revenue (INR),Total Appointments,Cancelled Appointments\n';
                // Merge revenue and cancellation by date
                const dateMap = {};
                revenueStats.revenueByDay.forEach(r => {
                    dateMap[r.date] = { date: r.date, revenue: r.revenue, appointments: r.paidAppointments, cancellations: 0 };
                });
                cancellationStats.cancellationsByDay.forEach(c => {
                    if (dateMap[c.date]) {
                        dateMap[c.date].cancellations = c.cancelledAppointments;
                        dateMap[c.date].appointments = Math.max(dateMap[c.date].appointments, c.totalAppointments);
                    } else {
                        dateMap[c.date] = { date: c.date, revenue: 0, appointments: c.totalAppointments, cancellations: c.cancelledAppointments };
                    }
                });
                
                Object.values(dateMap)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .forEach(row => {
                        csvContent += `${row.date},${row.revenue},${row.appointments},${row.cancellations}\n`;
                    });
                csvContent += '\n';

                // Section 3: Specialty Breakdown
                csvContent += 'SPECIALTY DISTRIBUTION PATTERNS\n';
                csvContent += 'Specialty,Total Appointments,Doctors Active,No Show Rate (%)\n';
                departmentStats.forEach(dept => {
                    csvContent += `"${dept.specialty}",${dept.totalAppointments},${dept.doctors},${dept.noShowRate}%\n`;
                });
                csvContent += '\n';

                // Section 4: Doctor Performance Calibration Matrix
                csvContent += 'DOCTOR PERFORMANCE CALIBRATION MATRIX\n';
                csvContent += 'Doctor Name,Specialty,Rating (5.0 max),Total Completed Appointments,Average Wait (mins),Average Duration (mins),Doctor Revenue Generated (INR)\n';
                performanceData.forEach(dp => {
                    csvContent += `"${dp.doctorName}","${dp.specialty}",${dp.rating},${dp.totalAppointments},${dp.avgWaitMins},${dp.avgDurationMins},${dp.revenue}\n`;
                });

                // Trigger Download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `clinic_intelligence_report_${timeframe}d.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                // Export Symptom Checker telemetry
                csvContent += 'AI SYMPTOM CHECKER TELEMETRY REPORT\n';
                csvContent += `Generated On,${new Date().toISOString()}\n\n`;

                csvContent += 'SPECIALTY ROUTING DISTRIBUTION\n';
                csvContent += 'Specialty,Search Count\n';
                (symptomStats?.specialtyDistribution || []).forEach(item => {
                    csvContent += `"${item.specialty}",${item.count}\n`;
                });
                csvContent += '\n';

                csvContent += 'TOP KEYWORDS SEARCHED\n';
                csvContent += 'Keyword,Frequency Count\n';
                (symptomStats?.topKeywords || []).forEach(item => {
                    csvContent += `"${item.keyword}",${item.count}\n`;
                });
                csvContent += '\n';

                csvContent += 'RECENT SYMPTOM SEARCH LOGS\n';
                csvContent += 'Log ID,Patient Name,Mapped Specialty,Symptoms Text,Search Date\n';
                (symptomStats?.recentLogs || []).forEach(log => {
                    csvContent += `${log.id},"${log.patient_name || 'Anonymous'}","${log.mapped_specialty}","${(log.symptoms_text || '').replace(/"/g, '""')}",${log.created_at}\n`;
                });

                // Trigger Download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `symptom_checker_telemetry_report.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Error compiling CSV document:', err);
        } finally {
            setDownloadingCsv(false);
        }
    };

    const filteredLogs = (symptomStats?.recentLogs || []).filter(log => 
        log.patient_name?.toLowerCase().includes(telemetrySearch.toLowerCase()) ||
        log.mapped_specialty?.toLowerCase().includes(telemetrySearch.toLowerCase()) ||
        log.symptoms_text?.toLowerCase().includes(telemetrySearch.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-24 px-4 md:px-6 animate-in fade-in duration-700">
            {/* Breadcrumb & Navigation */}
            <div className="flex items-center justify-between">
                <button 
                    onClick={() => navigate('/admin-dashboard')}
                    className="flex items-center gap-2 text-slate-500 hover:text-primary font-black text-[10px] uppercase tracking-[0.25em] transition-all group"
                >
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
                    Back to Admin Matrix
                </button>

                {/* Timeframe Selectors */}
                {activeTab === 'overview' && (
                    <div className="glass-card rounded-[1.5rem] p-1 border border-slate-100/30 flex gap-1">
                        {[7, 30, 90].map(days => (
                            <button
                                key={days}
                                onClick={() => setTimeframe(days)}
                                className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                    timeframe === days 
                                        ? 'bg-primary text-white shadow-md shadow-primary/20' 
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                            >
                                {days} Days
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Header Section */}
            <div className="glass-modal rounded-[3.5rem] p-10 border-none shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                        <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                            {activeTab === 'overview' ? (
                                <Activity size={36} strokeWidth={2.5} className="animate-pulse" />
                            ) : (
                                <Database size={36} strokeWidth={2.5} className="animate-pulse" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-5xl font-black text-[var(--text-base)] tracking-tighter uppercase leading-none mb-4">
                                {activeTab === 'overview' ? 'Intelligence Hub' : 'Symptom Telemetry'}
                            </h1>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">
                                {activeTab === 'overview' 
                                    ? 'Global clinic operations & analytics matrix' 
                                    : 'AI Clinical router mapping & diagnostic insights'}
                            </p>
                        </div>
                    </div>
                    
                    <button
                        onClick={exportCSV}
                        disabled={downloadingCsv}
                        className="px-8 py-4 bg-emerald-500 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 w-full md:w-auto"
                    >
                        <Download size={16} /> {downloadingCsv ? 'Compiling Registry...' : 'Export Telemetry'}
                    </button>
                </div>
            </div>

            {/* Tab Selection */}
            <div className="flex border-b border-slate-100/50 pb-px gap-8">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-4 text-xs font-black uppercase tracking-[0.25em] transition-all relative ${
                        activeTab === 'overview' 
                            ? 'text-primary' 
                            : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    Clinic Overview
                    {activeTab === 'overview' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in fade-in duration-300"></div>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('symptoms')}
                    className={`pb-4 text-xs font-black uppercase tracking-[0.25em] transition-all relative ${
                        activeTab === 'symptoms' 
                            ? 'text-primary' 
                            : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    Symptom Checker Telemetry
                    {activeTab === 'symptoms' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in fade-in duration-300"></div>
                    )}
                </button>
            </div>

            {activeTab === 'overview' ? (
                <>
                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* KPI Card 1: Revenue */}
                        <div className="glass-card p-8 rounded-[3rem] border-none shadow-xl shadow-slate-200/40 group hover:shadow-2xl transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity text-primary">
                                <DollarSign size={80} />
                            </div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-primary/10 text-primary rounded-2xl border border-primary/15 shadow-inner">
                                    <DollarSign size={24} strokeWidth={2.5} />
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">Gross Billing</span>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase tabular-nums">
                                    ₹{revenueStats.totalRevenue?.toLocaleString('en-IN')}
                                </h3>
                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <TrendingUp size={12} /> Positive Volume Tracked
                                </p>
                            </div>
                        </div>

                        {/* KPI Card 2: Avg Wait Time */}
                        <div className="glass-card p-8 rounded-[3rem] border-none shadow-xl shadow-slate-200/40 group hover:shadow-2xl transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity text-violet-500">
                                <Clock size={80} />
                            </div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-violet-500/10 text-violet-500 rounded-2xl border border-violet-500/15 shadow-inner">
                                    <Clock size={24} strokeWidth={2.5} />
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">Wait Metric</span>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase tabular-nums">
                                    {utilizationStats.avgWaitMins} <span className="text-lg">mins</span>
                                </h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Average clinic wait time
                                </p>
                            </div>
                        </div>

                        {/* KPI Card 3: Cancellation Rate */}
                        <div className="glass-card p-8 rounded-[3rem] border-none shadow-xl shadow-slate-200/40 group hover:shadow-2xl transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity text-rose-500">
                                <Percent size={80} />
                            </div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/15 shadow-inner">
                                    <Percent size={24} strokeWidth={2.5} />
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">Drop Rate</span>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase tabular-nums">
                                    {cancellationStats.cancellationRate}%
                                </h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    {cancellationStats.totalCancellations} cancellations out of {cancellationStats.totalAppointments}
                                </p>
                            </div>
                        </div>

                        {/* KPI Card 4: Active Nodes */}
                        <div className="glass-card p-8 rounded-[3rem] border-none shadow-xl shadow-slate-200/40 group hover:shadow-2xl transition-all relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity text-emerald-500">
                                <Stethoscope size={80} />
                            </div>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/15 shadow-inner">
                                    <Stethoscope size={24} strokeWidth={2.5} />
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] leading-none">Active Staff</span>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-4xl font-black text-[var(--text-base)] tracking-tighter uppercase tabular-nums">
                                    {utilizationStats.doctorPerformance.length} <span className="text-lg">Nodes</span>
                                </h3>
                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle size={10} /> Calibrated Practitioner Profiles
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Hourly Traffic and Specialty Distribution Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Bar Chart: Hourly Traffic (Peak hours) */}
                        <div className="lg:col-span-2 glass-card rounded-[3rem] border border-slate-100/20 p-8 shadow-xl">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-8">Hourly Clinic Traffic Flow</h3>
                            <div className="h-80 w-full">
                                {hourlyStats.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={hourlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                                    borderRadius: '16px', 
                                                    border: 'none',
                                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                    padding: '16px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
                                                }}
                                            />
                                            <Bar dataKey="total" name="Appointments" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={45} />
                                            <Bar dataKey="doctorsActive" name="Practitioners" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={45} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                        <Activity size={32} className="opacity-20" />
                                        <p className="text-sm">No hourly stats registry data found</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pie Chart: Specialty Distribution */}
                        <div className="glass-card rounded-[3rem] border border-slate-100/20 p-8 shadow-xl flex flex-col justify-between">
                            <div>
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-8">Specialty Node Booking</h3>
                                <div className="h-60 w-full relative flex items-center justify-center">
                                    {departmentStats.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={departmentStats}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={90}
                                                    paddingAngle={4}
                                                    dataKey="totalAppointments"
                                                    nameKey="specialty"
                                                >
                                                    {departmentStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                                        borderRadius: '16px', 
                                                        border: 'none',
                                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                        padding: '12px',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold',
                                                        textTransform: 'uppercase'
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="text-slate-400 space-y-2 flex flex-col items-center">
                                            <Activity size={32} className="opacity-20" />
                                            <p className="text-sm">No specialty metrics available</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Legend items details */}
                            <div className="grid grid-cols-2 gap-3 max-h-32 overflow-y-auto mt-4 pr-1 no-scrollbar text-[10px] font-black uppercase tracking-wider">
                                {departmentStats.slice(0, 8).map((dept, idx) => (
                                    <div key={dept.specialty} className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                                        <span className="truncate text-slate-500">{dept.specialty}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Daily Revenue & Cancellation Timeline Line Chart */}
                    <div className="glass-card rounded-[3rem] border border-slate-100/20 p-8 shadow-xl">
                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-8">Daily Revenue Stream</h3>
                        <div className="h-80 w-full">
                            {revenueStats.revenueByDay.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueStats.revenueByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tickFormatter={(str) => {
                                                if (!str) return '';
                                                const d = new Date(str);
                                                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            }}
                                            tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                                            dy={10} 
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} tickFormatter={(val) => `₹${val}`} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: '#fff', 
                                                borderRadius: '16px', 
                                                border: 'none',
                                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                padding: '16px',
                                                fontSize: '11px',
                                                fontWeight: 'bold'
                                            }}
                                            formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Daily Revenue']}
                                            labelFormatter={(label) => `DATE: ${new Date(label).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
                                        />
                                        <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} activeDot={{ r: 6 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                    <Activity size={32} className="opacity-20" />
                                    <p className="text-sm">No billing records found inside timeframe</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Doctor Performance Grid */}
                    <div className="glass-card rounded-[3rem] border border-slate-100/20 p-8 shadow-xl space-y-8">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em]">Practitioner Utilization & Rating Index</h3>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Active service node calibration profiles</p>
                            </div>
                            {/* Search Field */}
                            <div className="w-full sm:w-80 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="FILTER NODES..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50/50 border border-slate-200 p-4 pl-12 rounded-[1.5rem] text-xs font-black uppercase tracking-wider focus:outline-none focus:border-primary/40 focus:bg-white transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-3xl border border-slate-100/50 bg-white/40">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                                        <th className="p-6">Doctor Node</th>
                                        <th className="p-6">Specialty</th>
                                        <th className="p-6">Rating Matrix</th>
                                        <th className="p-6 text-center">Completed Slots</th>
                                        <th className="p-6 text-center">Avg Wait</th>
                                        <th className="p-6 text-center">Avg Duration</th>
                                        <th className="p-6 text-right">Attributed Revenue</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-bold text-[var(--text-base)] divide-y divide-slate-100/50">
                                    {filteredPerformance.map(dp => (
                                        <tr key={dp.doctorId} className="hover:bg-white/60 transition-all uppercase tracking-wider text-[10px]">
                                            <td className="p-6 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                    <Stethoscope size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-[var(--text-base)]">{dp.doctorName}</p>
                                                    <p className="text-[8px] font-black text-slate-400 tracking-widest mt-1">NODE ID: #{dp.doctorId}</p>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-[9px] font-black">
                                                    {dp.specialty}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-1.5">
                                                    <Award size={14} className="text-amber-500 fill-amber-500" />
                                                    <span className="font-black">{dp.rating || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-center font-black tabular-nums">{dp.totalAppointments}</td>
                                            <td className="p-6 text-center font-black tabular-nums text-violet-500">{dp.avgWaitMins}m</td>
                                            <td className="p-6 text-center font-black tabular-nums text-slate-500">{dp.avgDurationMins}m</td>
                                            <td className="p-6 text-right font-black text-primary tabular-nums">
                                                ₹{dp.revenue?.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredPerformance.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="p-16 text-center text-[10px] font-black text-slate-400 tracking-widest uppercase">
                                                No practitioner nodes matching search terms detected
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-12 animate-in fade-in duration-500">
                    {loadingSymptomStats ? (
                        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            <p className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase animate-pulse">Syncing Symptom Checker Telemetry...</p>
                        </div>
                    ) : symptomStats ? (
                        <>
                            {/* Distribution and Keywords Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Specialty Distribution Chart */}
                                <div className="lg:col-span-2 glass-card rounded-[3rem] border border-slate-100/20 p-8 shadow-xl">
                                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-8">AI Specialty Mapping Frequency</h3>
                                    <div className="h-80 w-full">
                                        {symptomStats.specialtyDistribution?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={symptomStats.specialtyDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="specialty" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                                                    <Tooltip 
                                                        contentStyle={{ 
                                                            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                                            borderRadius: '16px', 
                                                            border: 'none',
                                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                                                            padding: '16px',
                                                            fontSize: '11px',
                                                            fontWeight: 'bold',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    />
                                                    <Bar dataKey="count" name="Searches" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={45}>
                                                        {symptomStats.specialtyDistribution.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                                <Activity size={32} className="opacity-20" />
                                                <p className="text-xs font-black uppercase tracking-widest">No symptom mapping data registered</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Top Keywords Cloud/List */}
                                <div className="glass-card rounded-[3rem] border border-slate-100/20 p-8 shadow-xl flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-8">Top Searched Keywords</h3>
                                        {symptomStats.topKeywords?.length > 0 ? (
                                            <div className="flex flex-wrap gap-3">
                                                {symptomStats.topKeywords.map((item) => (
                                                    <div 
                                                        key={item.keyword} 
                                                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-100 hover:border-primary/20 hover:bg-white transition-all rounded-2xl group cursor-default"
                                                    >
                                                        <Tag size={12} className="text-slate-400 group-hover:text-primary transition-colors" />
                                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{item.keyword}</span>
                                                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{item.count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-20 text-center text-slate-400 space-y-2 flex flex-col items-center">
                                                <Tag size={32} className="opacity-20" />
                                                <p className="text-xs font-black uppercase tracking-widest">No keywords extracted yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Logs Table */}
                            <div className="glass-card rounded-[3rem] border border-slate-100/20 p-8 shadow-xl space-y-8">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em]">Diagnostic Search Registry</h3>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Historical log of patient-described symptoms and mappings</p>
                                    </div>
                                    {/* Search Bar */}
                                    <div className="w-full sm:w-80 relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="FILTER LOGS..."
                                            value={telemetrySearch}
                                            onChange={(e) => setTelemetrySearch(e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-200 p-4 pl-12 rounded-[1.5rem] text-xs font-black uppercase tracking-wider focus:outline-none focus:border-primary/40 focus:bg-white transition-all shadow-inner"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-3xl border border-slate-100/50 bg-white/40">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                                                <th className="p-6">Patient</th>
                                                <th className="p-6">Mapped Specialty</th>
                                                <th className="p-6">Symptom Description</th>
                                                <th className="p-6">Timestamp</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs font-bold text-[var(--text-base)] divide-y divide-slate-100/50">
                                            {filteredLogs.map(log => (
                                                <tr key={log.id} className="hover:bg-white/60 transition-all text-[10px]">
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                                                <Users size={16} />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-[var(--text-base)] uppercase tracking-wider">{log.patient_name || 'Anonymous Patient'}</p>
                                                                <p className="text-[8px] font-black text-slate-400 tracking-widest mt-1">LOG ID: #{log.id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span className={`px-3 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-widest ${getSpecialtyBadgeStyle(log.mapped_specialty)}`}>
                                                            {log.mapped_specialty}
                                                        </span>
                                                    </td>
                                                    <td className="p-6 font-semibold text-slate-600 max-w-md truncate" title={log.symptoms_text}>
                                                        "{log.symptoms_text}"
                                                    </td>
                                                    <td className="p-6 text-slate-400 tabular-nums font-black uppercase tracking-wider">
                                                        {new Date(log.created_at).toLocaleString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredLogs.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="p-16 text-center text-[10px] font-black text-slate-400 tracking-widest uppercase">
                                                        No symptom logs matching search terms detected
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-4">
                            <Activity size={48} className="text-slate-200" />
                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Failed to load symptom analytics</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminAnalytics;
