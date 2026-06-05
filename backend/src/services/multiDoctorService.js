/**
 * Issue #43: Multi-Doctor Routing Service
 * Handles appointments requiring visits to multiple doctors
 * Optimizes routing and provides unified tracking
 */

const db = require('../config/db');

class MultiDoctorService {
    constructor() {
        // Ensure methods are bound to this instance
        this.createJourney = this.createJourney.bind(this);
        this.getPatientJourneys = this.getPatientJourneys.bind(this);
        this.getJourneyDetails = this.getJourneyDetails.bind(this);
        this.updateStopStatus = this.updateStopStatus.bind(this);
        this.getRouteOptimization = this.getRouteOptimization.bind(this);
        this.getSuggestedCombinations = this.getSuggestedCombinations.bind(this);
        this.getJourneyAnalytics = this.getJourneyAnalytics.bind(this);
        this.getOptimalSlotPaths = this.getOptimalSlotPaths.bind(this);
        this.calculateTravelTime = this.calculateTravelTime.bind(this);
        this.calculateFloorChanges = this.calculateFloorChanges.bind(this);
        this.isSlotAfter = this.isSlotAfter.bind(this);
        this.diffMins = this.diffMins.bind(this);
        this.parseTime = this.parseTime.bind(this);
    }

    /**
     * Create a multi-doctor appointment journey (COORDINATION - Issue #43)
     */
    async createJourney(patientId, appointments) {
        // appointments: [{ doctorId, reason, timeSlot, date }]
        
        if (!appointments || appointments.length < 2) {
            throw new Error('Multi-doctor journey requires at least 2 doctors');
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Create journey record
            const scheduledDate = appointments[0].date;
            const [journeyResult] = await connection.execute(`
                INSERT INTO multi_doctor_journeys 
                (patient_id, total_stops, status, scheduled_date, created_at)
                VALUES (?, ?, 'PENDING', ?, NOW())
            `, [patientId, appointments.length, scheduledDate]);

            const journeyId = journeyResult.insertId;

            // 2. Create individual appointments and journey stops
            const journeyStops = [];
            for (let i = 0; i < appointments.length; i++) {
                const aptData = appointments[i];
                
                // A. Create the actual appointment
                const [aptResult] = await connection.execute(`
                    INSERT INTO appointments 
                    (patient_id, doctor_id, appointment_date, time_slot, status, reason, created_at)
                    VALUES (?, ?, ?, ?, 'PENDING', ?, NOW())
                `, [
                    patientId, 
                    aptData.doctorId, 
                    aptData.date, 
                    aptData.timeSlot, 
                    aptData.reason || 'Multi-Doctor Consultation'
                ]);

                const appointmentId = aptResult.insertId;

                // B. Create the journey stop linked to the appointment
                const [stopResult] = await connection.execute(`
                    INSERT INTO journey_stops 
                    (journey_id, doctor_id, appointment_id, stop_order, reason, status, estimated_duration_mins)
                    VALUES (?, ?, ?, ?, ?, 'PENDING', 20)
                `, [
                    journeyId,
                    aptData.doctorId,
                    appointmentId,
                    i + 1,
                    aptData.reason || 'Multi-Doctor Consultation'
                ]);

                journeyStops.push({
                    stopId: stopResult.insertId,
                    appointmentId,
                    order: i + 1,
                    doctorId: aptData.doctorId,
                    timeSlot: aptData.timeSlot,
                    status: 'PENDING'
                });
            }

            await connection.commit();

            return {
                journeyId,
                patientId,
                totalStops: appointments.length,
                status: 'PENDING',
                stops: journeyStops,
                message: 'Coordinated multi-doctor journey booked successfully'
            };

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Get patient's active journeys
     */
    async getPatientJourneys(patientId) {
        const sql = `
            SELECT j.*, 
                (SELECT COUNT(*) FROM journey_stops WHERE journey_id = j.id AND status = 'COMPLETED') as completed_stops
            FROM multi_doctor_journeys j
            WHERE j.patient_id = ?
            AND j.status IN ('PENDING', 'IN_PROGRESS')
            ORDER BY j.created_at DESC
        `;

        try {
            const [journeys] = await db.execute(sql, [patientId]);

            // Get stops for each journey
            for (const journey of journeys) {
                const [stops] = await db.execute(`
                    SELECT js.*, 
                        CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                        d.specialty, NULL as floor_number, NULL as building
                    FROM journey_stops js
                    JOIN doctors d ON js.doctor_id = d.id
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
    }

    /**
     * Get journey details
     */
    async getJourneyDetails(journeyId, patientId) {
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
                d.specialty, NULL as floor_number, NULL as building, d.location_room as room_number
            FROM journey_stops js
            JOIN doctors d ON js.doctor_id = d.id
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
            currentStop: stops.find(s => s.status === 'IN_PROGRESS') || stops.find(s => s.status === 'PENDING')
        };
    }

    /**
     * Update stop status (for doctors/admin)
     */
    async updateStopStatus(stopId, status, notes) {
        const validStatuses = ['PENDING', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
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
                ${status === 'COMPLETED' ? 'completed_at = NOW(),' : ''}
                ${status === 'CHECKED_IN' ? 'checked_in_at = NOW(),' : ''}
                ${status === 'IN_PROGRESS' ? 'started_at = NOW(),' : ''}
                updated_at = NOW()
            WHERE id = ?
        `.replace(/,\s*WHERE/, ' WHERE'), [status, notes, stopId]);

        // Check if journey is complete
        const [remaining] = await db.execute(`
            SELECT COUNT(*) as count FROM journey_stops
            WHERE journey_id = ? AND status NOT IN ('COMPLETED', 'SKIPPED')
        `, [stop.journey_id]);

        if (remaining[0].count === 0) {
            await db.execute(`
                UPDATE multi_doctor_journeys SET status = 'COMPLETED', completed_at = NOW()
                WHERE id = ?
            `, [stop.journey_id]);
        } else if (status === 'IN_PROGRESS') {
            await db.execute(`
                UPDATE multi_doctor_journeys SET status = 'IN_PROGRESS'
                WHERE id = ? AND status = 'PENDING'
            `, [stop.journey_id]);
        }

        return { success: true, stopId, status };
    }

    /**
     * Implement a simple travel time matrix between nodes.
     * Used for route optimization between doctors.
     */
    calculateTravelTime(nodeA, nodeB) {
        if (!nodeA || !nodeB) return 0;
        
        // Base time between buildings
        if (nodeA.building !== nodeB.building) {
            // e.g., 'A' to 'B' takes 10 mins + elevator time
            return 10 + Math.abs((nodeA.floor_number || 1) - 1) * 2 + Math.abs((nodeB.floor_number || 1) - 1) * 2;
        }
        
        // Same building, different floors (e.g., 2 mins per floor)
        return Math.abs((nodeA.floor_number || 1) - (nodeB.floor_number || 1)) * 2;
    }

    /**
     * Get optimal route suggestion
     */
    async getRouteOptimization(doctorIds) {
        if (!doctorIds || doctorIds.length < 2) {
            return { optimized: doctorIds, savings: 0 };
        }

        const [doctors] = await db.execute(`
            SELECT d.id, CONCAT(d.first_name, ' ', d.last_name) as name,
                d.specialty, NULL as floor_number, NULL as building
            FROM doctors d
            WHERE d.id IN (${doctorIds.map(() => '?').join(',')})
        `, doctorIds);

        // Preserve original order requested
        const original = doctorIds.map(id => doctors.find(d => d.id == id)).filter(Boolean);

        // Greedy nearest-neighbor optimization
        const unvisited = [...original];
        const optimized = [];
        
        if (unvisited.length > 0) {
            // Start from the first appointment location
            let current = unvisited.shift();
            optimized.push(current);
            
            while (unvisited.length > 0) {
                let nearestIdx = 0;
                let minTime = Infinity;
                
                for (let i = 0; i < unvisited.length; i++) {
                    const time = this.calculateTravelTime(current, unvisited[i]);
                    if (time < minTime) {
                        minTime = time;
                        nearestIdx = i;
                    }
                }
                
                current = unvisited.splice(nearestIdx, 1)[0];
                optimized.push(current);
            }
        }

        // Calculate travel times
        let originalTime = 0;
        for (let i = 1; i < original.length; i++) {
            originalTime += this.calculateTravelTime(original[i - 1], original[i]);
        }

        let optimizedTime = 0;
        for (let i = 1; i < optimized.length; i++) {
            optimizedTime += this.calculateTravelTime(optimized[i - 1], optimized[i]);
        }

        const originalFloorChanges = this.calculateFloorChanges(original);
        const optimizedFloorChanges = this.calculateFloorChanges(optimized);

        return {
            original,
            optimized,
            floorChangesSaved: originalFloorChanges - optimizedFloorChanges,
            estimatedTimeSavedMins: Math.max(0, originalTime - optimizedTime),
            originalTravelTimeMins: originalTime,
            optimizedTravelTimeMins: optimizedTime
        };
    }

    /**
     * Helper to calculate floor changes
     */
    calculateFloorChanges(doctors) {
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
    }

    /**
     * Get suggested doctors for multi-visit scenarios
     */
    async getSuggestedCombinations(symptom) {
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
                d.specialty, NULL as floor_number, NULL as building
            FROM doctors d
            WHERE d.specialty IN (${suggestedSpecialties.map(() => '?').join(',')})
            ORDER BY d.specialty, d.first_name
        `, suggestedSpecialties);

        return {
            symptom,
            suggestedSpecialties,
            doctors,
            message: `Consider visiting these specialties: ${suggestedSpecialties.join(' → ')}`
        };
    }

    /**
     * Get journey analytics (admin/doctor)
     */
    async getJourneyAnalytics(startDate, endDate) {
        try {
            const [stats] = await db.execute(`
                SELECT 
                    COUNT(*) as total_journeys,
                    AVG(total_stops) as avg_stops,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress
                FROM multi_doctor_journeys
                WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
            `, [startDate, endDate]);

            const [popularCombos] = await db.execute(`
                SELECT 
                    GROUP_CONCAT(DISTINCT d.specialty ORDER BY js.stop_order SEPARATOR ' → ') as route,
                    COUNT(DISTINCT j.id) as count
                FROM multi_doctor_journeys j
                JOIN journey_stops js ON j.id = js.journey_id
                JOIN doctors d ON js.doctor_id = d.id
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
    }

    /**
     * COORDINATION & SCHEDULING (Issue #43)
     * Find optimal combinations of slots for multiple doctors
     */
    async getOptimalSlotPaths(doctorIds, date) {
        // 1. Get doctor details and travel factors
        const [doctors] = await db.execute(`
            SELECT id, CONCAT(first_name, ' ', last_name) as name,
                specialty, floor_number, building, location_room as room_number,
                max_patients_per_slot
        FROM doctors
            WHERE id IN (${doctorIds.map(() => '?').join(',')})
        `, doctorIds);

        const docMap = {};
        doctors.forEach(d => docMap[d.id] = d);

        // 2. Fetch available slots for each doctor on that date
        const doctorSlots = {};
        for (const id of doctorIds) {
            const [booked] = await db.execute(`
                SELECT time_slot, COUNT(*) as count 
                FROM appointments 
                WHERE doctor_id = ? AND appointment_date = ? AND status != 'CANCELLED'
                GROUP BY time_slot
            `, [id, date]);

            const bookedMap = {};
            booked.forEach(b => bookedMap[b.time_slot] = b.count);

            // Standard slots (9am - 5pm, 30m intervals)
            const allSlots = [
                '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
                '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
                '04:00 PM', '04:30 PM'
            ];

            const capacity = docMap[id]?.max_patients_per_slot || 15;
            doctorSlots[id] = allSlots.filter(s => (bookedMap[s] || 0) < capacity);
        }

        // 3. Find valid paths (sequences of slots with travel/buffer time)
        const paths = [];
        const orderedDoctorIds = [...doctorIds]; 

        const findPathsRecursive = (currentIndex, currentPath) => {
            if (currentIndex === orderedDoctorIds.length) {
                paths.push([...currentPath]);
                return;
            }

            const doctorId = orderedDoctorIds[currentIndex];
            const available = doctorSlots[doctorId] || [];

            for (const slot of available) {
                if (currentPath.length === 0) {
                    findPathsRecursive(currentIndex + 1, [{ doctorId, slot, doctorName: docMap[doctorId].name }]);
                } else {
                    const prev = currentPath[currentPath.length - 1];
                    const prevDoc = docMap[prev.doctorId];
                    const currDoc = docMap[doctorId];

                    // Calculate required gap (mins)
                    let travelMins = 5; // internal building
                    if (prevDoc.building !== currDoc.building) travelMins = 15;
                    else travelMins += Math.abs((prevDoc.floor_number || 1) - (currDoc.floor_number || 1)) * 2;

                    const bufferMins = 15; // mandatory buffer
                    const totalGapNeeded = travelMins + bufferMins;

                    if (this.isSlotAfter(prev.slot, slot, totalGapNeeded)) {
                        findPathsRecursive(currentIndex + 1, [...currentPath, { doctorId, slot, doctorName: docMap[doctorId].name }]);
                    }
                }
            }
        };

        findPathsRecursive(0, []);

        // 4. Rank paths by total duration (first to last)
        const rankedPaths = paths.map(p => {
            const start = p[0].slot;
            const end = p[p.length - 1].slot;
            const duration = this.diffMins(start, end) + 20; // +20 for last consultation
            
            return {
                items: p,
                totalDurationMins: duration,
                startTime: start,
                endTime: end
            };
        }).sort((a, b) => a.totalDurationMins - b.totalDurationMins);

        return rankedPaths.slice(0, 5); // Return top 5
    }

    /**
     * Helper: Slot time comparison
     */
    isSlotAfter(slot1, slot2, gapMins) {
        return this.diffMins(slot1, slot2) >= gapMins;
    }

    /**
     * Helper: Calculate difference in minutes between two slots
     */
    diffMins(slot1, slot2) {
        const d1 = this.parseTime(slot1);
        const d2 = this.parseTime(slot2);
        return (d2 - d1) / (1000 * 60);
    }

    /**
     * Helper: Parse time string to Date object
     */
    parseTime(timeStr) {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        const d = new Date();
        d.setHours(hours, minutes, 0, 0);
        return d;
    }
}

module.exports = new MultiDoctorService();
