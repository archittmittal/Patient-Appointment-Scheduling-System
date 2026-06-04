const peakHoursService = require('../src/services/peakHoursService');
const db = require('../src/config/db');

async function verify() {
    console.log('Starting verification of clinic-wide analytics queries...');
    try {
        const analytics = await peakHoursService.getClinicWideAnalytics(30);
        console.log('Analytics payload retrieved successfully!');
        
        // Assert structure
        const requiredKeys = [
            'hourlyStats',
            'departmentStats',
            'revenueStats',
            'cancellationStats',
            'utilizationStats',
            'summary'
        ];
        
        for (const key of requiredKeys) {
            if (!(key in analytics)) {
                throw new Error(`Missing expected key in analytics response: ${key}`);
            }
            console.log(`- Key found: ${key}`);
        }
        
        console.log('Revenue stats summary:');
        console.log(`- Total Revenue: ${analytics.revenueStats.totalRevenue}`);
        console.log(`- Revenue records count: ${analytics.revenueStats.revenueByDay.length}`);
        console.log(`- Doctor revenue records count: ${analytics.revenueStats.revenueByDoctor.length}`);
        
        console.log('Cancellation stats summary:');
        console.log(`- Cancellation Rate: ${analytics.cancellationStats.cancellationRate}%`);
        console.log(`- Total Appointments: ${analytics.cancellationStats.totalAppointments}`);
        console.log(`- Total Cancellations: ${analytics.cancellationStats.totalCancellations}`);
        
        console.log('Utilization stats summary:');
        console.log(`- Avg Wait Mins: ${analytics.utilizationStats.avgWaitMins}`);
        console.log(`- Avg Duration Mins: ${analytics.utilizationStats.avgDurationMins}`);
        console.log(`- Doctor performance count: ${analytics.utilizationStats.doctorPerformance.length}`);
        
        console.log('Summary patterns:');
        console.log(`- Peak Hour: ${analytics.summary.peakHour}`);
        console.log(`- Quiet Hour: ${analytics.summary.quietHour}`);
        console.log(`- Busiest Specialty/Dept: ${analytics.summary.busiestDept}`);
        
        console.log('\nSUCCESS: Analytics service passes integration verification!');
        process.exit(0);
    } catch (error) {
        console.error('FAILED: Analytics verification failed with error:');
        console.error(error);
        process.exit(1);
    }
}

verify();
