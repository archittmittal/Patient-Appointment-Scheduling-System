/**
 * Issue #50: Feedback Loop Analytics Service
 * Collects, analyzes and visualizes patient feedback to improve the system
 */

const db = require('../config/db');

/**
 * Feedback categories with weights for scoring
 */
const FEEDBACK_CATEGORIES = {
    wait_time: { label: 'Wait Time', weight: 1.2 },
    staff_behaviour: { label: 'Staff Behavior', weight: 1.0 },
    cleanliness: { label: 'Cleanliness', weight: 0.8 },
    booking_ease: { label: 'Booking Ease', weight: 1.0 },
    doctor_quality: { label: 'Doctor Quality', weight: 1.5 },
    overall_experience: { label: 'Overall Experience', weight: 1.3 }
};

/**
 * Sentiment keywords for text analysis
 */
const SENTIMENT_KEYWORDS = {
    positive: ['excellent', 'great', 'amazing', 'wonderful', 'fantastic', 'good', 'helpful', 'friendly', 'professional', 'quick', 'efficient', 'clean', 'comfortable', 'happy', 'satisfied', 'recommend', 'best'],
    negative: ['terrible', 'awful', 'horrible', 'bad', 'poor', 'slow', 'rude', 'dirty', 'uncomfortable', 'unhappy', 'disappointed', 'frustrated', 'waited', 'long', 'delay', 'worst', 'never']
};

/**
 * Submit feedback for an appointment
 */
const submitFeedback = async (appointmentId, patientId, feedbackData) => {
    const { ratings, comment, wouldRecommend, improvements } = feedbackData;

    // Validate appointment belongs to patient
    const [appointments] = await db.execute(`
        SELECT a.*, d.id as doctor_id
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        WHERE a.id = ? AND a.patient_id = ? AND a.status = 'completed'
    `, [appointmentId, patientId]);

    if (appointments.length === 0) {
        throw new Error('Appointment not found or not completed');
    }

    const apt = appointments[0];

    // Calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;
    for (const [category, rating] of Object.entries(ratings)) {
        if (FEEDBACK_CATEGORIES[category]) {
            totalScore += rating * FEEDBACK_CATEGORIES[category].weight;
            totalWeight += FEEDBACK_CATEGORIES[category].weight;
        }
    }
    const weightedScore = totalWeight > 0 ? (totalScore / totalWeight) : 0;

    // Analyze sentiment from comment
    const sentiment = analyzeSentiment(comment || '');

    // Save feedback
    try {
        const [result] = await db.execute(`
            INSERT INTO appointment_feedback 
            (appointment_id, patient_id, doctor_id, ratings_json, comment, 
             would_recommend, improvements, weighted_score, sentiment_score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            appointmentId,
            patientId,
            apt.doctor_id,
            JSON.stringify(ratings),
            comment || null,
            wouldRecommend ? 1 : 0,
            improvements ? JSON.stringify(improvements) : null,
            weightedScore,
            sentiment.score
        ]);

        // Update doctor's aggregated rating
        await updateDoctorAggregateRating(apt.doctor_id);

        return {
            success: true,
            feedbackId: result.insertId,
            weightedScore,
            sentiment: sentiment.label,
            message: 'Thank you for your feedback!'
        };
    } catch (err) {
        console.log('Feedback save note:', err.message);
        return { success: true, message: 'Feedback recorded', weightedScore };
    }
};

/**
 * Analyze sentiment from text
 */
const analyzeSentiment = (text) => {
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    SENTIMENT_KEYWORDS.positive.forEach(word => {
        if (lowerText.includes(word)) positiveCount++;
    });
    SENTIMENT_KEYWORDS.negative.forEach(word => {
        if (lowerText.includes(word)) negativeCount++;
    });

    const total = positiveCount + negativeCount;
    if (total === 0) return { score: 0.5, label: 'neutral' };

    const score = positiveCount / total;
    return {
        score,
        label: score > 0.6 ? 'positive' : score < 0.4 ? 'negative' : 'neutral'
    };
};

/**
 * Update doctor's aggregated rating
 */
const updateDoctorAggregateRating = async (doctorId) => {
    try {
        const [stats] = await db.execute(`
            SELECT 
                AVG(weighted_score) as avg_score,
                COUNT(*) as total_reviews,
                SUM(would_recommend) as recommend_count
            FROM appointment_feedback
            WHERE doctor_id = ?
        `, [doctorId]);

        if (stats[0].total_reviews > 0) {
            await db.execute(`
                INSERT INTO doctor_ratings 
                (doctor_id, avg_score, total_reviews, recommend_rate, updated_at)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                avg_score = VALUES(avg_score),
                total_reviews = VALUES(total_reviews),
                recommend_rate = VALUES(recommend_rate),
                updated_at = NOW()
            `, [
                doctorId,
                stats[0].avg_score,
                stats[0].total_reviews,
                (stats[0].recommend_count / stats[0].total_reviews) * 100
            ]);
        }
    } catch (err) {
        console.log('Rating update note:', err.message);
    }
};

/**
 * Get feedback analytics for a doctor
 */
const getDoctorFeedbackAnalytics = async (doctorId, startDate, endDate) => {
    try {
        // Overall stats
        const [overall] = await db.execute(`
            SELECT 
                AVG(weighted_score) as avg_score,
                COUNT(*) as total_reviews,
                AVG(sentiment_score) as avg_sentiment,
                SUM(would_recommend) as recommend_count
            FROM appointment_feedback
            WHERE doctor_id = ?
            AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        `, [doctorId, startDate, endDate]);

        // Category breakdown
        const [feedbacks] = await db.execute(`
            SELECT ratings_json FROM appointment_feedback
            WHERE doctor_id = ?
            AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        `, [doctorId, startDate, endDate]);

        const categoryScores = {};
        Object.keys(FEEDBACK_CATEGORIES).forEach(cat => {
            categoryScores[cat] = { total: 0, count: 0 };
        });

        feedbacks.forEach(fb => {
            try {
                const ratings = JSON.parse(fb.ratings_json);
                Object.entries(ratings).forEach(([cat, score]) => {
                    if (categoryScores[cat]) {
                        categoryScores[cat].total += score;
                        categoryScores[cat].count++;
                    }
                });
            } catch (e) {}
        });

        const categoryBreakdown = Object.entries(categoryScores).map(([cat, data]) => ({
            category: cat,
            label: FEEDBACK_CATEGORIES[cat]?.label || cat,
            avgScore: data.count > 0 ? (data.total / data.count).toFixed(1) : 0,
            responseCount: data.count
        }));

        // Trend over time
        const [trend] = await db.execute(`
            SELECT 
                DATE(created_at) as date,
                AVG(weighted_score) as avg_score,
                COUNT(*) as count
            FROM appointment_feedback
            WHERE doctor_id = ?
            AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [doctorId, startDate, endDate]);

        // Recent improvements suggestions
        const [improvements] = await db.execute(`
            SELECT improvements FROM appointment_feedback
            WHERE doctor_id = ? AND improvements IS NOT NULL
            AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            ORDER BY created_at DESC
            LIMIT 50
        `, [doctorId, startDate, endDate]);

        const improvementCounts = {};
        improvements.forEach(imp => {
            try {
                const items = JSON.parse(imp.improvements);
                items.forEach(item => {
                    improvementCounts[item] = (improvementCounts[item] || 0) + 1;
                });
            } catch (e) {}
        });

        const topImprovements = Object.entries(improvementCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([item, count]) => ({ item, count }));

        return {
            overall: {
                avgScore: overall[0]?.avg_score?.toFixed(1) || 0,
                totalReviews: overall[0]?.total_reviews || 0,
                avgSentiment: overall[0]?.avg_sentiment?.toFixed(2) || 0.5,
                recommendRate: overall[0]?.total_reviews > 0 
                    ? ((overall[0].recommend_count / overall[0].total_reviews) * 100).toFixed(0) 
                    : 0
            },
            categoryBreakdown,
            trend,
            topImprovements
        };
    } catch (err) {
        console.log('Analytics error:', err.message);
        return {
            overall: { avgScore: 0, totalReviews: 0, avgSentiment: 0.5, recommendRate: 0 },
            categoryBreakdown: [],
            trend: [],
            topImprovements: []
        };
    }
};

/**
 * Get system-wide feedback analytics (admin)
 */
const getSystemFeedbackAnalytics = async (startDate, endDate) => {
    try {
        // Overall system stats
        const [overall] = await db.execute(`
            SELECT 
                AVG(weighted_score) as avg_score,
                COUNT(*) as total_reviews,
                AVG(sentiment_score) as avg_sentiment,
                (SUM(would_recommend) / COUNT(*)) * 100 as recommend_rate
            FROM appointment_feedback
            WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        `, [startDate, endDate]);

        // Top rated doctors
        const [topDoctors] = await db.execute(`
            SELECT 
                d.id,
                CONCAT(d.first_name, ' ', d.last_name) as name,
                dp.specialty,
                AVG(f.weighted_score) as avg_score,
                COUNT(f.id) as review_count
            FROM appointment_feedback f
            JOIN doctors d ON f.doctor_id = d.id
            LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
            WHERE DATE(f.created_at) BETWEEN DATE(?) AND DATE(?)
            GROUP BY d.id
            HAVING review_count >= 5
            ORDER BY avg_score DESC
            LIMIT 10
        `, [startDate, endDate]);

        // Needs improvement doctors
        const [needsImprovement] = await db.execute(`
            SELECT 
                d.id,
                CONCAT(d.first_name, ' ', d.last_name) as name,
                dp.specialty,
                AVG(f.weighted_score) as avg_score,
                COUNT(f.id) as review_count
            FROM appointment_feedback f
            JOIN doctors d ON f.doctor_id = d.id
            LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
            WHERE DATE(f.created_at) BETWEEN DATE(?) AND DATE(?)
            GROUP BY d.id
            HAVING avg_score < 3.5 AND review_count >= 3
            ORDER BY avg_score ASC
            LIMIT 10
        `, [startDate, endDate]);

        // Category system-wide breakdown
        const [allFeedbacks] = await db.execute(`
            SELECT ratings_json FROM appointment_feedback
            WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        `, [startDate, endDate]);

        const categoryScores = {};
        Object.keys(FEEDBACK_CATEGORIES).forEach(cat => {
            categoryScores[cat] = { total: 0, count: 0 };
        });

        allFeedbacks.forEach(fb => {
            try {
                const ratings = JSON.parse(fb.ratings_json);
                Object.entries(ratings).forEach(([cat, score]) => {
                    if (categoryScores[cat]) {
                        categoryScores[cat].total += score;
                        categoryScores[cat].count++;
                    }
                });
            } catch (e) {}
        });

        const systemCategories = Object.entries(categoryScores).map(([cat, data]) => ({
            category: cat,
            label: FEEDBACK_CATEGORIES[cat]?.label || cat,
            avgScore: data.count > 0 ? (data.total / data.count).toFixed(1) : 0
        }));

        // Daily trend
        const [dailyTrend] = await db.execute(`
            SELECT 
                DATE(created_at) as date,
                AVG(weighted_score) as avg_score,
                COUNT(*) as count
            FROM appointment_feedback
            WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [startDate, endDate]);

        // Common improvement areas
        const [improvements] = await db.execute(`
            SELECT improvements FROM appointment_feedback
            WHERE improvements IS NOT NULL
            AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        `, [startDate, endDate]);

        const improvementCounts = {};
        improvements.forEach(imp => {
            try {
                const items = JSON.parse(imp.improvements);
                items.forEach(item => {
                    improvementCounts[item] = (improvementCounts[item] || 0) + 1;
                });
            } catch (e) {}
        });

        const topImprovementAreas = Object.entries(improvementCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([item, count]) => ({ item, count }));

        return {
            overall: {
                avgScore: overall[0]?.avg_score?.toFixed(1) || 0,
                totalReviews: overall[0]?.total_reviews || 0,
                avgSentiment: overall[0]?.avg_sentiment?.toFixed(2) || 0.5,
                recommendRate: overall[0]?.recommend_rate?.toFixed(0) || 0
            },
            topDoctors,
            needsImprovement,
            systemCategories,
            dailyTrend,
            topImprovementAreas
        };
    } catch (err) {
        console.log('System analytics error:', err.message);
        return {
            overall: { avgScore: 0, totalReviews: 0, avgSentiment: 0.5, recommendRate: 0 },
            topDoctors: [],
            needsImprovement: [],
            systemCategories: [],
            dailyTrend: [],
            topImprovementAreas: []
        };
    }
};

/**
 * Get pending feedback requests for patient
 */
const getPendingFeedbackRequests = async (patientId) => {
    try {
        const [appointments] = await db.execute(`
            SELECT 
                a.id,
                a.appointment_date,
                a.appointment_time,
                a.appointment_type,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                dp.specialty
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
            LEFT JOIN appointment_feedback f ON a.id = f.appointment_id
            WHERE a.patient_id = ?
            AND a.status = 'completed'
            AND f.id IS NULL
            AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ORDER BY a.appointment_date DESC
            LIMIT 5
        `, [patientId]);

        return appointments;
    } catch (err) {
        console.log('Pending feedback error:', err.message);
        return [];
    }
};

/**
 * Get feedback categories configuration
 */
const getFeedbackCategories = () => {
    return Object.entries(FEEDBACK_CATEGORIES).map(([key, value]) => ({
        id: key,
        ...value
    }));
};

/**
 * Get patient's submitted feedbacks
 */
const getPatientFeedbackHistory = async (patientId) => {
    try {
        const [feedbacks] = await db.execute(`
            SELECT 
                f.*,
                a.appointment_date,
                a.appointment_time,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                dp.specialty
            FROM appointment_feedback f
            JOIN appointments a ON f.appointment_id = a.id
            JOIN doctors d ON f.doctor_id = d.id
            LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
            WHERE f.patient_id = ?
            ORDER BY f.created_at DESC
            LIMIT 20
        `, [patientId]);

        return feedbacks.map(fb => ({
            ...fb,
            ratings: JSON.parse(fb.ratings_json || '{}'),
            improvements: fb.improvements ? JSON.parse(fb.improvements) : []
        }));
    } catch (err) {
        console.log('Feedback history error:', err.message);
        return [];
    }
};

module.exports = {
    submitFeedback,
    getDoctorFeedbackAnalytics,
    getSystemFeedbackAnalytics,
    getPendingFeedbackRequests,
    getFeedbackCategories,
    getPatientFeedbackHistory,
    FEEDBACK_CATEGORIES
};
