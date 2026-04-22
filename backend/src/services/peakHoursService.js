/**
 * Issue #44: Peak Hours Analytics Service
 * Analyzes appointment patterns to identify busy/quiet periods
 * Helps patients choose optimal scheduling times
 */

const db = require('../config/db');

const peakHoursService = {
    /**
     * Get hourly appointment distribution for a doctor
     */
    async getDoctorHourlyStats(doctorId, daysBack = 90) {
        const [rows] = await db.query(`
            SELECT 
                HOUR(time_slot) as hour,
                DAYOFWEEK(appointment_date) as day_of_week,
                COUNT(*) as total_appointments,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) as no_shows,
                AVG(TIMESTAMPDIFF(MINUTE, time_slot, actual_end_time)) as avg_wait_mins
            FROM appointments
            WHERE doctor_id = ?
              AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND status NOT IN ('CANCELLED')
            GROUP BY HOUR(time_slot), DAYOFWEEK(appointment_date)
            ORDER BY day_of_week, hour
        `, [doctorId, daysBack]);

        return this.formatHourlyStats(rows);
    },

    /**
     * Get peak hours analysis for a doctor
     */
    async getPeakHoursAnalysis(doctorId, daysBack = 90) {
        // Get appointments by hour
        const [hourlyData] = await db.query(`
            SELECT 
                HOUR(time_slot) as hour,
                COUNT(*) as count,
                AVG(TIMESTAMPDIFF(MINUTE, 
                    STR_TO_DATE(time_slot, '%H:%i'), 
                    IFNULL(actual_start_time, STR_TO_DATE(time_slot, '%H:%i'))
                )) as avg_delay_mins
            FROM appointments
            WHERE doctor_id = ?
              AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND status NOT IN ('CANCELLED')
            GROUP BY HOUR(time_slot)
            ORDER BY hour
        `, [doctorId, daysBack]);

        // Calculate peak and off-peak hours
        const totalAppts = hourlyData.reduce((sum, h) => sum + h.count, 0);
        const avgPerHour = totalAppts / (hourlyData.length || 1);

        const peakHours = hourlyData
            .filter(h => h.count > avgPerHour * 1.3)
            .map(h => h.hour);
        
        const quietHours = hourlyData
            .filter(h => h.count < avgPerHour * 0.7)
            .map(h => h.hour);

        // Get busiest and quietest day
        const [dailyData] = await db.query(`
            SELECT 
                DAYOFWEEK(appointment_date) as day_of_week,
                DAYNAME(appointment_date) as day_name,
                COUNT(*) as count
            FROM appointments
            WHERE doctor_id = ?
              AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND status NOT IN ('CANCELLED')
            GROUP BY DAYOFWEEK(appointment_date), DAYNAME(appointment_date)
            ORDER BY day_of_week
        `, [doctorId, daysBack]);

        const busiestDay = dailyData.reduce((max, d) => d.count > max.count ? d : max, dailyData[0] || {});
        const quietestDay = dailyData.reduce((min, d) => d.count < min.count ? d : min, dailyData[0] || {});

        return {
            hourlyDistribution: hourlyData.map(h => ({
                hour: h.hour,
                displayHour: this.formatHour(h.hour),
                appointments: h.count,
                avgDelayMins: Math.round(h.avg_delay_mins || 0),
                trafficLevel: this.getTrafficLevel(h.count, avgPerHour)
            })),
            peakHours: peakHours.map(h => this.formatHour(h)),
            quietHours: quietHours.map(h => this.formatHour(h)),
            busiestDay: busiestDay?.day_name || 'N/A',
            quietestDay: quietestDay?.day_name || 'N/A',
            recommendation: this.generateRecommendation(quietHours, quietestDay?.day_name)
        };
    },

    /**
     * Get weekly heatmap data for a doctor
     */
    async getWeeklyHeatmap(doctorId, daysBack = 90) {
        const [rows] = await db.query(`
            SELECT 
                DAYOFWEEK(appointment_date) as day,
                HOUR(time_slot) as hour,
                COUNT(*) as count
            FROM appointments
            WHERE doctor_id = ?
              AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND status NOT IN ('CANCELLED')
            GROUP BY DAYOFWEEK(appointment_date), HOUR(time_slot)
        `, [doctorId, daysBack]);

        // Create 7x24 matrix (days x hours)
        const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));
        const maxCount = Math.max(...rows.map(r => r.count), 1);

        rows.forEach(row => {
            // MySQL DAYOFWEEK: 1=Sunday, 2=Monday, etc.
            // Convert to 0=Monday, 1=Tuesday, etc.
            const dayIndex = row.day === 1 ? 6 : row.day - 2;
            heatmap[dayIndex][row.hour] = Math.round((row.count / maxCount) * 100);
        });

        return {
            heatmap,
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            hours: Array(24).fill(0).map((_, i) => this.formatHour(i)),
            maxValue: maxCount
        };
    },

    /**
     * Get best booking times (slots with historically lower wait times)
     */
    async getBestBookingTimes(doctorId, daysBack = 90) {
        const [rows] = await db.query(`
            SELECT 
                DAYNAME(appointment_date) as day_name,
                DAYOFWEEK(appointment_date) as day_of_week,
                HOUR(time_slot) as hour,
                COUNT(*) as total_appointments,
                AVG(CASE 
                    WHEN actual_start_time IS NOT NULL 
                    THEN TIMESTAMPDIFF(MINUTE, STR_TO_DATE(time_slot, '%H:%i'), actual_start_time)
                    ELSE 0 
                END) as avg_wait_mins,
                SUM(CASE WHEN status = 'NO_SHOW' THEN 1 ELSE 0 END) / COUNT(*) * 100 as no_show_rate
            FROM appointments
            WHERE doctor_id = ?
              AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND status NOT IN ('CANCELLED')
            GROUP BY DAYNAME(appointment_date), DAYOFWEEK(appointment_date), HOUR(time_slot)
            HAVING COUNT(*) >= 3
            ORDER BY avg_wait_mins ASC, total_appointments ASC
            LIMIT 10
        `, [doctorId, daysBack]);

        return rows.map((row, index) => ({
            rank: index + 1,
            day: row.day_name,
            time: this.formatHour(row.hour),
            avgWaitMins: Math.round(row.avg_wait_mins || 0),
            appointments: row.total_appointments,
            noShowRate: Math.round(row.no_show_rate || 0),
            score: this.calculateBookingScore(row)
        }));
    },

    /**
     * Get real-time crowd level for today
     */
    async getCurrentCrowdLevel(doctorId) {
        const currentHour = new Date().getHours();

        // Get today's remaining appointments
        const [todayStats] = await db.query(`
            SELECT 
                COUNT(*) as total_remaining,
                SUM(CASE WHEN status = 'CHECKED_IN' THEN 1 ELSE 0 END) as checked_in,
                SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress
            FROM appointments
            WHERE doctor_id = ?
              AND DATE(appointment_date) = CURDATE()
              AND HOUR(time_slot) >= ?
              AND status IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        `, [doctorId, currentHour]);

        // Get average for this hour historically
        const [historicalAvg] = await db.query(`
            SELECT AVG(count) as avg_count
            FROM (
                SELECT DATE(appointment_date) as date, COUNT(*) as count
                FROM appointments
                WHERE doctor_id = ?
                  AND HOUR(time_slot) = ?
                  AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                  AND DATE(appointment_date) < CURDATE()
                GROUP BY DATE(appointment_date)
            ) as daily_counts
        `, [doctorId, currentHour]);

        const current = todayStats[0] || { total_remaining: 0, checked_in: 0, in_progress: 0 };
        const avgForHour = historicalAvg[0]?.avg_count || 5;

        let crowdLevel = 'normal';
        let crowdScore = Math.round((current.total_remaining / avgForHour) * 100);
        
        if (crowdScore > 130) crowdLevel = 'busy';
        else if (crowdScore > 100) crowdLevel = 'moderate';
        else if (crowdScore < 70) crowdLevel = 'quiet';

        return {
            crowdLevel,
            crowdScore: Math.min(crowdScore, 150),
            patientsWaiting: current.checked_in || 0,
            inConsultation: current.in_progress || 0,
            remainingToday: current.total_remaining,
            recommendation: this.getCrowdRecommendation(crowdLevel)
        };
    },

    /**
     * Get clinic-wide analytics (for admin)
     */
    async getClinicWideAnalytics(daysBack = 30) {
        // Overall busy hours
        const [hourlyStats] = await db.query(`
            SELECT 
                HOUR(time_slot) as hour,
                COUNT(*) as total,
                COUNT(DISTINCT doctor_id) as doctors_active
            FROM appointments
            WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND status NOT IN ('CANCELLED')
            GROUP BY HOUR(time_slot)
            ORDER BY hour
        `, [daysBack]);

        // Per-department stats
        const [deptStats] = await db.query(`
            SELECT 
                s.name as specialty,
                COUNT(*) as total_appointments,
                COUNT(DISTINCT a.doctor_id) as doctors,
                AVG(CASE WHEN a.status = 'NO_SHOW' THEN 1 ELSE 0 END) * 100 as no_show_rate
            FROM appointments a
            JOIN users u ON a.doctor_id = u.id
            JOIN specialties s ON u.specialty_id = s.id
            WHERE a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
              AND a.status NOT IN ('CANCELLED')
            GROUP BY s.name
            ORDER BY total_appointments DESC
        `, [daysBack]);

        return {
            hourlyStats: hourlyStats.map(h => ({
                hour: this.formatHour(h.hour),
                total: h.total,
                doctorsActive: h.doctors_active
            })),
            departmentStats: deptStats,
            summary: {
                peakHour: hourlyStats.reduce((max, h) => h.total > max.total ? h : max, hourlyStats[0])?.hour,
                quietHour: hourlyStats.reduce((min, h) => h.total < min.total ? h : min, hourlyStats[0])?.hour,
                busiestDept: deptStats[0]?.specialty
            }
        };
    },

    // Helper methods
    formatHour(hour) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:00 ${ampm}`;
    },

    getTrafficLevel(count, average) {
        if (count > average * 1.5) return 'very-high';
        if (count > average * 1.2) return 'high';
        if (count > average * 0.8) return 'normal';
        if (count > average * 0.5) return 'low';
        return 'very-low';
    },

    calculateBookingScore(row) {
        // Lower wait + Lower crowd = Better score (0-100)
        const waitScore = Math.max(0, 100 - (row.avg_wait_mins || 0) * 3);
        const crowdScore = Math.max(0, 100 - row.total_appointments * 5);
        const noShowPenalty = row.no_show_rate * 0.5;
        return Math.round((waitScore * 0.6 + crowdScore * 0.4 - noShowPenalty));
    },

    generateRecommendation(quietHours, quietestDay) {
        if (quietHours.length === 0) {
            return "This doctor has consistent appointment volume. Book early to secure your preferred time.";
        }
        
        const quietTimeStr = quietHours.slice(0, 2).map(h => this.formatHour(h)).join(' or ');
        return `For shorter wait times, consider booking on ${quietestDay || 'weekdays'} around ${quietTimeStr}.`;
    },

    getCrowdRecommendation(level) {
        const recommendations = {
            busy: "Currently busy. Consider booking for later today or another day.",
            moderate: "Moderate traffic. Expect some waiting time.",
            normal: "Normal activity. Good time to visit.",
            quiet: "Low traffic right now. Great time for your visit!"
        };
        return recommendations[level] || recommendations.normal;
    },

    formatHourlyStats(rows) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return rows.map(row => ({
            ...row,
            day_name: days[row.day_of_week - 1],
            hour_display: this.formatHour(row.hour)
        }));
    }
};

module.exports = peakHoursService;
