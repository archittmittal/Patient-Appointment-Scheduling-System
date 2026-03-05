/**
 * Issue #49: Appointment Batching Service
 * Groups similar appointments together for efficiency
 * E.g., Vaccinations, routine check-ups, follow-ups can be batched
 */

const db = require('../config/db');

/**
 * Get appointment types that can be batched
 */
const getBatchableTypes = async () => {
    const batchableTypes = [
        { 
            id: 'VACCINATION', 
            name: 'Vaccination', 
            description: 'Routine immunizations',
            maxBatchSize: 10,
            slotDurationMins: 15,
            color: '#10B981'
        },
        { 
            id: 'ROUTINE_CHECKUP', 
            name: 'Routine Check-up', 
            description: 'Regular health screenings',
            maxBatchSize: 6,
            slotDurationMins: 20,
            color: '#3B82F6'
        },
        { 
            id: 'FOLLOWUP', 
            name: 'Follow-up Visit', 
            description: 'Post-treatment follow-ups',
            maxBatchSize: 8,
            slotDurationMins: 10,
            color: '#8B5CF6'
        },
        { 
            id: 'LAB_REVIEW', 
            name: 'Lab Results Review', 
            description: 'Discuss test results',
            maxBatchSize: 8,
            slotDurationMins: 10,
            color: '#F59E0B'
        },
        { 
            id: 'PRESCRIPTION_REFILL', 
            name: 'Prescription Refill', 
            description: 'Medication refill consultations',
            maxBatchSize: 12,
            slotDurationMins: 5,
            color: '#EC4899'
        }
    ];
    return batchableTypes;
};

/**
 * Get available batch slots for a doctor
 */
const getBatchSlots = async (doctorId, date) => {
    const sql = `
        SELECT bs.*, 
            COUNT(DISTINCT ba.id) as current_count,
            GROUP_CONCAT(CONCAT(p.first_name, ' ', p.last_name) SEPARATOR ', ') as patients
        FROM batch_slots bs
        LEFT JOIN batch_appointments ba ON bs.id = ba.batch_slot_id AND ba.status != 'cancelled'
        LEFT JOIN patients p ON ba.patient_id = p.id
        WHERE bs.doctor_id = ?
        AND DATE(bs.slot_date) = DATE(?)
        AND bs.status = 'open'
        GROUP BY bs.id
        HAVING current_count < bs.max_capacity
        ORDER BY bs.start_time
    `;
    
    try {
        const [rows] = await db.execute(sql, [doctorId, date]);
        return rows;
    } catch (err) {
        // Table might not exist yet
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return [];
        }
        throw err;
    }
};

/**
 * Create a new batch slot
 */
const createBatchSlot = async (doctorId, data) => {
    const { batchType, date, startTime, maxCapacity, notes } = data;
    
    // Get batch type info
    const batchTypes = await getBatchableTypes();
    const typeInfo = batchTypes.find(t => t.id === batchType);
    
    if (!typeInfo) {
        throw new Error('Invalid batch type');
    }

    const sql = `
        INSERT INTO batch_slots 
        (doctor_id, batch_type, slot_date, start_time, max_capacity, duration_mins, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
    `;

    const [result] = await db.execute(sql, [
        doctorId,
        batchType,
        date,
        startTime,
        maxCapacity || typeInfo.maxBatchSize,
        typeInfo.slotDurationMins * (maxCapacity || typeInfo.maxBatchSize),
        notes || null
    ]);

    return { 
        id: result.insertId, 
        batchType,
        typeInfo,
        date,
        startTime,
        maxCapacity: maxCapacity || typeInfo.maxBatchSize
    };
};

/**
 * Book a batch appointment
 */
const bookBatchAppointment = async (patientId, batchSlotId, reason) => {
    // Check if slot is available
    const [slots] = await db.execute(`
        SELECT bs.*, 
            (SELECT COUNT(*) FROM batch_appointments WHERE batch_slot_id = bs.id AND status != 'cancelled') as current_count
        FROM batch_slots bs
        WHERE bs.id = ?
    `, [batchSlotId]);

    if (slots.length === 0) {
        throw new Error('Batch slot not found');
    }

    const slot = slots[0];

    if (slot.current_count >= slot.max_capacity) {
        throw new Error('This batch slot is full');
    }

    if (slot.status !== 'open') {
        throw new Error('This batch slot is no longer available');
    }

    // Check if patient already has a batch appointment in this slot
    const [existing] = await db.execute(`
        SELECT id FROM batch_appointments 
        WHERE batch_slot_id = ? AND patient_id = ? AND status != 'cancelled'
    `, [batchSlotId, patientId]);

    if (existing.length > 0) {
        throw new Error('You already have an appointment in this batch');
    }

    // Calculate position in queue
    const position = slot.current_count + 1;

    // Insert batch appointment
    const [result] = await db.execute(`
        INSERT INTO batch_appointments 
        (batch_slot_id, patient_id, queue_position, reason, status, created_at)
        VALUES (?, ?, ?, ?, 'scheduled', NOW())
    `, [batchSlotId, patientId, position, reason]);

    return {
        id: result.insertId,
        batchSlotId,
        position,
        batchType: slot.batch_type,
        slotDate: slot.slot_date,
        startTime: slot.start_time,
        message: `You're #${position} in the batch appointment`
    };
};

/**
 * Get patient's batch appointments
 */
const getPatientBatchAppointments = async (patientId) => {
    const sql = `
        SELECT ba.*, bs.batch_type, bs.slot_date, bs.start_time, bs.duration_mins,
            CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
            dp.specialty
        FROM batch_appointments ba
        JOIN batch_slots bs ON ba.batch_slot_id = bs.id
        JOIN doctors d ON bs.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE ba.patient_id = ?
        AND DATE(bs.slot_date) >= CURDATE()
        AND ba.status != 'cancelled'
        ORDER BY bs.slot_date, bs.start_time
    `;

    try {
        const [rows] = await db.execute(sql, [patientId]);
        return rows;
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return [];
        }
        throw err;
    }
};

/**
 * Get doctor's batch schedule
 */
const getDoctorBatchSchedule = async (doctorId, startDate, endDate) => {
    const sql = `
        SELECT bs.*,
            COUNT(DISTINCT ba.id) as booked_count,
            (bs.max_capacity - COUNT(DISTINCT ba.id)) as available_count
        FROM batch_slots bs
        LEFT JOIN batch_appointments ba ON bs.id = ba.batch_slot_id AND ba.status != 'cancelled'
        WHERE bs.doctor_id = ?
        AND DATE(bs.slot_date) BETWEEN DATE(?) AND DATE(?)
        GROUP BY bs.id
        ORDER BY bs.slot_date, bs.start_time
    `;

    try {
        const [rows] = await db.execute(sql, [doctorId, startDate, endDate]);
        return rows;
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return [];
        }
        throw err;
    }
};

/**
 * Get batch slot details with patients
 */
const getBatchSlotDetails = async (slotId) => {
    const [slots] = await db.execute(`
        SELECT bs.*, CONCAT(d.first_name, ' ', d.last_name) as doctor_name
        FROM batch_slots bs
        JOIN doctors d ON bs.doctor_id = d.id
        WHERE bs.id = ?
    `, [slotId]);

    if (slots.length === 0) {
        throw new Error('Batch slot not found');
    }

    const [patients] = await db.execute(`
        SELECT ba.*, CONCAT(p.first_name, ' ', p.last_name) as patient_name, p.phone
        FROM batch_appointments ba
        JOIN patients p ON ba.patient_id = p.id
        WHERE ba.batch_slot_id = ?
        AND ba.status != 'cancelled'
        ORDER BY ba.queue_position
    `, [slotId]);

    return {
        ...slots[0],
        patients,
        bookedCount: patients.length,
        availableCount: slots[0].max_capacity - patients.length
    };
};

/**
 * Suggest best batch slots for a patient based on their needs
 */
const suggestBatchSlots = async (patientId, appointmentType, preferredDate) => {
    // Map common appointment reasons to batch types
    const typeMapping = {
        'vaccination': 'VACCINATION',
        'vaccine': 'VACCINATION',
        'immunization': 'VACCINATION',
        'checkup': 'ROUTINE_CHECKUP',
        'check-up': 'ROUTINE_CHECKUP',
        'routine': 'ROUTINE_CHECKUP',
        'follow-up': 'FOLLOWUP',
        'followup': 'FOLLOWUP',
        'lab': 'LAB_REVIEW',
        'test results': 'LAB_REVIEW',
        'refill': 'PRESCRIPTION_REFILL',
        'prescription': 'PRESCRIPTION_REFILL'
    };

    let batchType = null;
    const lowerType = appointmentType.toLowerCase();
    
    for (const [key, value] of Object.entries(typeMapping)) {
        if (lowerType.includes(key)) {
            batchType = value;
            break;
        }
    }

    if (!batchType) {
        return { suggestions: [], message: 'This appointment type is not eligible for batch scheduling' };
    }

    // Find available batch slots for this type
    const sql = `
        SELECT bs.*,
            CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
            dp.specialty,
            (SELECT COUNT(*) FROM batch_appointments WHERE batch_slot_id = bs.id AND status != 'cancelled') as current_count
        FROM batch_slots bs
        JOIN doctors d ON bs.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE bs.batch_type = ?
        AND DATE(bs.slot_date) >= DATE(?)
        AND bs.status = 'open'
        HAVING current_count < bs.max_capacity
        ORDER BY ABS(DATEDIFF(bs.slot_date, ?)), bs.start_time
        LIMIT 5
    `;

    try {
        const [rows] = await db.execute(sql, [batchType, preferredDate || new Date(), preferredDate || new Date()]);
        
        return {
            batchType,
            suggestions: rows.map(row => ({
                ...row,
                availableSpots: row.max_capacity - row.current_count
            })),
            message: `Found ${rows.length} batch slots for ${appointmentType}`
        };
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return { suggestions: [], message: 'Batch scheduling is being set up' };
        }
        throw err;
    }
};

/**
 * Cancel batch slot (doctor only)
 */
const cancelBatchSlot = async (slotId, doctorId, reason) => {
    // Verify ownership
    const [slots] = await db.execute(`
        SELECT * FROM batch_slots WHERE id = ? AND doctor_id = ?
    `, [slotId, doctorId]);

    if (slots.length === 0) {
        throw new Error('Batch slot not found or access denied');
    }

    // Update slot status
    await db.execute(`
        UPDATE batch_slots SET status = 'cancelled', cancelled_reason = ? WHERE id = ?
    `, [reason, slotId]);

    // Cancel all appointments in this slot
    await db.execute(`
        UPDATE batch_appointments SET status = 'cancelled' WHERE batch_slot_id = ?
    `, [slotId]);

    return { success: true, message: 'Batch slot cancelled and patients notified' };
};

/**
 * Get batch analytics for admin/doctors
 */
const getBatchAnalytics = async (doctorId, startDate, endDate) => {
    try {
        const [typeStats] = await db.execute(`
            SELECT bs.batch_type, 
                COUNT(DISTINCT bs.id) as total_slots,
                COUNT(DISTINCT ba.id) as total_appointments,
                AVG(bs.max_capacity) as avg_capacity,
                SUM(CASE WHEN ba.status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN ba.status = 'no-show' THEN 1 ELSE 0 END) as no_shows
            FROM batch_slots bs
            LEFT JOIN batch_appointments ba ON bs.id = ba.batch_slot_id
            WHERE bs.doctor_id = ?
            AND DATE(bs.slot_date) BETWEEN DATE(?) AND DATE(?)
            GROUP BY bs.batch_type
        `, [doctorId, startDate, endDate]);

        const [utilizationStats] = await db.execute(`
            SELECT 
                DATE_FORMAT(bs.slot_date, '%Y-%m-%d') as date,
                SUM(bs.max_capacity) as total_capacity,
                COUNT(DISTINCT ba.id) as total_booked
            FROM batch_slots bs
            LEFT JOIN batch_appointments ba ON bs.id = ba.batch_slot_id AND ba.status != 'cancelled'
            WHERE bs.doctor_id = ?
            AND DATE(bs.slot_date) BETWEEN DATE(?) AND DATE(?)
            GROUP BY DATE(bs.slot_date)
            ORDER BY bs.slot_date
        `, [doctorId, startDate, endDate]);

        return {
            byType: typeStats,
            utilization: utilizationStats,
            avgUtilization: utilizationStats.length > 0 
                ? (utilizationStats.reduce((sum, d) => sum + (d.total_booked / d.total_capacity), 0) / utilizationStats.length * 100).toFixed(1)
                : 0
        };
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return { byType: [], utilization: [], avgUtilization: 0 };
        }
        throw err;
    }
};

module.exports = {
    getBatchableTypes,
    getBatchSlots,
    createBatchSlot,
    bookBatchAppointment,
    getPatientBatchAppointments,
    getDoctorBatchSchedule,
    getBatchSlotDetails,
    suggestBatchSlots,
    cancelBatchSlot,
    getBatchAnalytics
};
