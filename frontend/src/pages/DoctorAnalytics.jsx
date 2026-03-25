import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import PeakHoursAnalytics from '../components/PeakHoursAnalytics';
import { BarChart3, Clock, TrendingUp } from 'lucide-react';

const DoctorAnalytics = () => {
    const { user } = useAuth();

    if (!user || user.role !== 'DOCTOR') {
        return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <BarChart3 className="text-primary" size={32} />
                        Performance & Peak Hours
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Deep dive into your appointment patterns and patient flow analytics.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-8">
                {/* Integration of Peak Hours Analytics */}
                <PeakHoursAnalytics doctorId={user.id} />
                
                {/* Placeholder for future detailed analytics */}
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-primary">
                        <TrendingUp size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Patient Retention Insights</h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                        In the next update, we'll bring you detailed insights into patient follow-up rates 
                        and long-term care management trends.
                    </p>
                    <button className="px-6 py-2 bg-gray-50 text-gray-500 rounded-xl font-medium cursor-not-allowed">
                        Coming Soon
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DoctorAnalytics;
