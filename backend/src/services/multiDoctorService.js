/**
 * Issue #43: Multi-Doctor Routing Service
 * Handles appointments requiring visits to multiple doctors
 * Optimizes routing and provides unified tracking
 */

const db = require('../config/db');

/**
 * Create a multi-doctor appointment journey
 */
const createJourney = async (patientId, appointments) => {
    // appointments: [{ doctorId, reason, preferredTime }]
    
    if (!appointments || appointments.length < 2) {
        throw new Error('Multi-doctor journey requires at least 2 doctors');
    }

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Create journey record
        const [journeyResult] = await connection.execute(`
            INSERT INTO multi_doctor_journeys 
            (patient_id, total_stops, status, created_at)
            VALUES (?, ?, 'pending', NOW())
        `, [patientId, appointments.length]);

        const journeyId = journeyResult.insertId;

        // Get doctor details for optimization
        const doctorIds = appointments.map(a => a.doctorId);
        const [doctors] = await connection.execute(`
            SELECT d.id, CONCAT(d.first_name, ' ', d.last_name) as name,
                dp.specialty, dp.floor_number, dp.building
            FROM doctors d
            LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
            WHERE d.id IN (${doctorIds.map(() => '?').join(',')})
        `, doctorIds);

        // Create doctor map
        const doctorMap = {};
        doctors.forEach(d => doctorMap[d.id] = d);

        // Optimize order based on floor/building (simple optimization)
        const optimizedAppointments = [...appointments].sort((a, b) => {
            const docA = doctorMap[a.doctorId] || {};
            const docB = doctorMap[b.doctorId] || {};
            
            // Sort by building first, then floor
            if (docA.building !== docB.building) {
                return (docA.building || 'A').localeCompare(docB.building || 'A');
            }
            return (docA.floor_number || 1) - (docB.floor_number || 1);
        });

        // Create individual appointments
        const journeyStops = [];
        for (let i = 0; i < optimizedAppointments.length; i++) {
            const apt = optimizedAppointments[i];
            const doctor = doctorMap[apt.doctorId] || {};

            // Insert journey stop
            const [stopResult] = await connection.execute(`
                INSERT INTO journey_stops 
                (journey_id, doctor_id, stop_order, reason, status, estimated_duration_mins)
                VALUES (?, ?, ?, ?, 'pending', ?)
            `, [
                journeyId,
                apt.doctorId,
                i + 1,
                apt.reason || 'Consultation',
                apt.estimatedDuration || 20
            ]);

            journeyStops.push({
                stopId: stopResult.insertId,
                order: i + 1,
                doctorId: apt.doctorId,
                doctorName: doctor.name,
                specialty: doctor.specialty,
                floor: doctor.floor_number,
                building: doctor.building,
                status: 'pending'
            });
        }

        await connection.commit();

        return {
            journeyId,
            patientId,
            totalStops: appointments.length,
            status: 'pending',
            stops: journeyStops,
            message: 'Multi-doctor journey created successfully'
        };

    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

/**
 * Get patient's active journeys
 */
const getPatientJourneys = async (patientId) => {
    const sql = `
        SELECT j.*, 
            (SELECT COUNT(*) FROM journey_stops WHERE journey_id = j.id AND status = 'completed') as completed_stops
        FROM multi_doctor_journeys j
        WHERE j.patient_id = ?
        AND j.status IN ('pending', 'in_progress')
        ORDER BY j.created_at DESC
    `;

    try {
        const [journeys] = await db.execute(sql, [patientId]);

        // Get stops for each journey
        for (const journey of journeys) {
            const [stops] = await db.execute(`
                SELECT js.*, 
                    CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                    dp.specialty, dp.floor_number, dp.building
                FROM journey_stops js
                JOIN doctors d ON js.doctor_id = d.id
                LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
                WHERE js.journey_id = ?
                ORDER BY js.stop_order
            `, [journey.id]);
            
            journey.stops = stops;
        }

        return journeys;
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return [];
        }
        throw err;
    }
};

/**
 * Get journey details
 */
const getJourneyDetails = async (journeyId, patientId) => {
    const [journeys] = await db.execute(`
        SELECT * FROM multi_doctor_journeys
        WHERE id = ? AND patient_id = ?
    `, [journeyId, patientId]);

    if (journeys.length === 0) {
        throw new Error('Journey not found');
    }

    const journey = journeys[0];

    const [stops] = await db.execute(`
        SELECT js.*, 
            CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
            dp.specialty, dp.floor_number, dp.building, dp.room_number
        FROM journey_stops js
        JOIN doctors d ON js.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE js.journey_id = ?
        ORDER BY js.stop_order
    `, [journeyId]);

    // Calculate estimated times
    let cumulativeTime = 0;
    for (const stop of stops) {
        stop.estimatedStartOffset = cumulativeTime;
        cumulativeTime += stop.estimated_duration_mins || 20;
        stop.estimatedEndOffset = cumulativeTime;
    }

    return {
        ...journey,
        stops,
        totalEstimatedMins: cumulativeTime,
        currentStop: stops.find(s => s.status === 'in_progress') || stops.find(s => s.status === 'pending')
    };
};

/**
 * Update stop status (for doctors/admin)
 */
const updateStopStatus = async (stopId, status, notes) => {
    const validStatuses = ['pending', 'checked_in', 'in_progress', 'completed', 'skipped'];
    if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
    }

    // Get stop and journey info
    const [stops] = await db.execute(`
        SELECT js.*, j.patient_id, j.id as journey_id
        FROM journey_stops js
        JOIN multi_doctor_journeys j ON js.journey_id = j.id
        WHERE js.id = ?
    `, [stopId]);

    if (stops.length === 0) {
        throw new Error('Stop not found');
    }

    const stop = stops[0];

    // Update stop
    await db.execute(`
        UPDATE journey_stops 
        SET status = ?, 
            notes = ?,
            ${status === 'completed' ? 'completed_at = NOW(),' : ''}
            ${status === 'checked_in' ? 'checked_in_at = NOW(),' : ''}
            ${status === 'in_progress' ? 'started_at = NOW(),' : ''}
            updated_at = NOW()
        WHERE id = ?
    `.replace(/,\s*WHERE/, ' WHERE'), [status, notes, stopId]);

    // Check if journey is complete
    const [remaining] = await db.execute(`
        SELECT COUNT(*) as count FROM journey_stops
        WHERE journey_id = ? AND status NOT IN ('completed', 'skipped')
    `, [stop.journey_id]);

    if (remaining[0].count === 0) {
        await db.execute(`
            UPDATE multi_doctor_journeys SET status = 'completed', completed_at = NOW()
            WHERE id = ?
        `, [stop.journey_id]);
    } else if (status === 'in_progress') {
        await db.execute(`
            UPDATE multi_doctor_journeys SET status = 'in_progress'
            WHERE id = ? AND status = 'pending'
        `, [stop.journey_id]);
    }

    return { success: true, stopId, status };
};

/**
 * Get optimal route suggestion
 */
const getRouteOptimization = async (doctorIds) => {
    if (!doctorIds || doctorIds.length < 2) {
        return { optimized: doctorIds, savings: 0 };
    }

    const [doctors] = await db.execute(`
        SELECT d.id, CONCAT(d.first_name, ' ', d.last_name) as name,
            dp.specialty, dp.floor_number, dp.building
        FROM doctors d
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE d.id IN (${doctorIds.map(() => '?').join(',')})
    `, doctorIds);

    // Simple optimization by building/floor
    const optimized = [...doctors].sort((a, b) => {
        if (a.building !== b.building) {
            return (a.building || 'A').localeCompare(b.building || 'A');
        }
        return (a.floor_number || 1) - (b.floor_number || 1);
    });

    // Calculate theoretical savings (simplified)
    const originalFloorChanges = calculateFloorChanges(doctorIds.map(id => doctors.find(d => d.id === id)));
    const optimizedFloorChanges = calculateFloorChanges(optimized);
    const savingsMins = (originalFloorChanges - optimizedFloorChanges) * 3; // 3 mins per floor change saved

    return {
        original: doctors,
        optimized,
        floorChangesSaved: originalFloorChanges - optimizedFloorChanges,
        estimatedTimeSavedMins: Math.max(0, savingsMins)
    };
};

/**
 * Helper to calculate floor changes
 */
const calculateFloorChanges = (doctors) => {
    let changes = 0;
    for (let i = 1; i < doctors.length; i++) {
        const prev = doctors[i - 1];
        const curr = doctors[i];
        if (prev && curr) {
            if (prev.building !== curr.building) {
                changes += 3; // Building change = 3 floor changes worth
            } else {
                changes += Math.abs((prev.floor_number || 1) - (curr.floor_number || 1));
            }
        }
    }
    return changes;
};

/**
 * Get suggested doctors for multi-visit scenarios
 */
const getSuggestedCombinations = async (symptom) => {
    // Common multi-doctor combinations
    const combinations = {
        'chest pain': ['Cardiology', 'Pulmonology'],
        'headache': ['Neurology', 'Ophthalmology'],
        'fatigue': ['Internal Medicine', 'Endocrinology'],
        'back pain': ['Orthopedics', 'Neurology'],
        'digestive': ['Gastroenterology', 'Nutrition'],
        'skin rash': ['Dermatology', 'Allergy'],
        'joint pain': ['Orthopedics', 'Rheumatology']
    };

    const lowerSymptom = symptom.toLowerCase();
    let suggestedSpecialties = [];
    
    for (const [key, specialties] of Object.entries(combinations)) {
        if (lowerSymptom.includes(key)) {
            suggestedSpecialties = specialties;
            break;
        }
    }

    if (suggestedSpecialties.length === 0) {
        return { suggestions: [], message: 'No multi-doctor combination suggested for this symptom' };
    }

    // Find available doctors for these specialties
    const [doctors] = await db.execute(`
        SELECT d.id, CONCAT(d.first_name, ' ', d.last_name) as name,
            dp.specialty, dp.floor_number, dp.building
        FROM doctors d
        JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE dp.specialty IN (${suggestedSpecialties.map(() => '?').join(',')})
        ORDER BY dp.specialty, d.first_name
    `, suggestedSpecialties);

    return {
        symptom,
        suggestedSpecialties,
        doctors,
        message: `Consider visiting these specialties: ${suggestedSpecialties.join(' → ')}`
    };
};

/**
 * Get journey analytics (admin/doctor)
 */
const getJourneyAnalytics = async (startDate, endDate) => {
    try {
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_journeys,
                AVG(total_stops) as avg_stops,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
            FROM multi_doctor_journeys
            WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        `, [startDate, endDate]);

        const [popularCombos] = await db.execute(`
            SELECT 
                GROUP_CONCAT(DISTINCT dp.specialty ORDER BY js.stop_order SEPARATOR ' → ') as route,
                COUNT(DISTINCT j.id) as count
            FROM multi_doctor_journeys j
            JOIN journey_stops js ON j.id = js.journey_id
            JOIN doctors d ON js.doctor_id = d.id
            JOIN doctor_profiles dp ON d.id = dp.doctor_id
            WHERE DATE(j.created_at) BETWEEN DATE(?) AND DATE(?)
            GROUP BY j.id
            ORDER BY count DESC
            LIMIT 5
        `, [startDate, endDate]);

        return {
            summary: stats[0],
            popularRoutes: popularCombos
        };
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return { summary: {}, popularRoutes: [] };
        }
        throw err;
    }
};

module.exports = {
    createJourney,
    getPatientJourneys,
    getJourneyDetails,
    updateStopStatus,
    getRouteOptimization,
    getSuggestedCombinations,
    getJourneyAnalytics
};
