/**
 * Issue #46: Patient Prep Checklist Service
 * Provides pre-appointment preparation instructions for patients
 */

const db = require('../config/db');

/**
 * Get default prep items for different appointment types/specialties
 */
const getDefaultPrepItems = () => {
    return {
        'General': [
            { id: 'general_id', label: 'Bring valid ID/Insurance card', priority: 'required', icon: '🪪' },
            { id: 'general_records', label: 'Bring relevant medical records', priority: 'recommended', icon: '📋' },
            { id: 'general_medications', label: 'List of current medications', priority: 'required', icon: '💊' },
            { id: 'general_questions', label: 'Write down questions/concerns', priority: 'recommended', icon: '❓' }
        ],
        'Cardiology': [
            { id: 'cardio_fasting', label: 'Fast for 12 hours before blood work', priority: 'required', icon: '🍽️' },
            { id: 'cardio_bp', label: 'Take blood pressure reading at home', priority: 'recommended', icon: '❤️' },
            { id: 'cardio_symptoms', label: 'Note any chest pain or palpitations', priority: 'recommended', icon: '📝' },
            { id: 'cardio_comfortable', label: 'Wear comfortable, loose clothing', priority: 'recommended', icon: '👕' }
        ],
        'Dermatology': [
            { id: 'derm_makeup', label: 'Remove makeup/nail polish', priority: 'required', icon: '💅' },
            { id: 'derm_photos', label: 'Take photos of concerning areas', priority: 'recommended', icon: '📸' },
            { id: 'derm_products', label: 'List skincare products you use', priority: 'recommended', icon: '🧴' }
        ],
        'Gastroenterology': [
            { id: 'gastro_fasting', label: 'Fast for 8-12 hours before', priority: 'required', icon: '🍽️' },
            { id: 'gastro_symptoms', label: 'Track digestive symptoms for a week', priority: 'recommended', icon: '📊' },
            { id: 'gastro_diet', label: 'Maintain food diary', priority: 'recommended', icon: '🥗' }
        ],
        'Orthopedics': [
            { id: 'ortho_xrays', label: 'Bring previous X-rays/MRIs', priority: 'required', icon: '🩻' },
            { id: 'ortho_clothing', label: 'Wear shorts/loose clothes for exam', priority: 'required', icon: '👖' },
            { id: 'ortho_pain', label: 'Note pain level and triggers', priority: 'recommended', icon: '📝' }
        ],
        'Ophthalmology': [
            { id: 'eye_glasses', label: 'Bring current glasses/contacts', priority: 'required', icon: '👓' },
            { id: 'eye_driver', label: 'Arrange a driver (dilation possible)', priority: 'required', icon: '🚗' },
            { id: 'eye_history', label: 'Family history of eye disease', priority: 'recommended', icon: '👨‍👩‍👧' }
        ],
        'Pediatrics': [
            { id: 'pedi_vaccine', label: 'Bring immunization records', priority: 'required', icon: '💉' },
            { id: 'pedi_growth', label: 'Note growth/development concerns', priority: 'recommended', icon: '📏' },
            { id: 'pedi_comfort', label: 'Bring comfort item for child', priority: 'recommended', icon: '🧸' }
        ],
        'Lab Work': [
            { id: 'lab_fasting', label: 'Fast for 8-12 hours (water allowed)', priority: 'required', icon: '🍽️' },
            { id: 'lab_water', label: 'Stay hydrated before blood draw', priority: 'required', icon: '💧' },
            { id: 'lab_sleeves', label: 'Wear short sleeves or loose top', priority: 'recommended', icon: '👕' }
        ],
        'Vaccination': [
            { id: 'vax_records', label: 'Bring vaccination records', priority: 'required', icon: '📋' },
            { id: 'vax_allergies', label: 'Report any vaccine allergies', priority: 'required', icon: '⚠️' },
            { id: 'vax_arm', label: 'Wear short sleeves', priority: 'recommended', icon: '👕' }
        ],
        'Follow-up': [
            { id: 'followup_results', label: 'Review previous test results', priority: 'recommended', icon: '📊' },
            { id: 'followup_questions', label: 'Prepare questions for doctor', priority: 'recommended', icon: '❓' },
            { id: 'followup_symptoms', label: 'Track symptoms since last visit', priority: 'recommended', icon: '📝' }
        ]
    };
};

/**
 * Get prep checklist for an appointment
 */
const getAppointmentPrep = async (appointmentId, patientId) => {
    // Get appointment details
    const [appointments] = await db.execute(`
        SELECT a.*, 
            CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
            dp.specialty
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE a.id = ? AND a.patient_id = ?
    `, [appointmentId, patientId]);

    if (appointments.length === 0) {
        throw new Error('Appointment not found');
    }

    const appointment = appointments[0];

    // Get custom prep items for this appointment (if any)
    let customItems = [];
    try {
        const [custom] = await db.execute(`
            SELECT * FROM appointment_prep_items
            WHERE appointment_id = ?
            ORDER BY priority DESC, display_order
        `, [appointmentId]);
        customItems = custom;
    } catch (err) {
        // Table might not exist yet
    }

    // Get patient's completion status
    let completedItems = [];
    try {
        const [completed] = await db.execute(`
            SELECT item_id, completed_at FROM patient_prep_completion
            WHERE appointment_id = ? AND patient_id = ?
        `, [appointmentId, patientId]);
        completedItems = completed.map(c => c.item_id);
    } catch (err) {
        // Table might not exist yet
    }

    // Get default items based on specialty
    const defaults = getDefaultPrepItems();
    const specialtyItems = defaults[appointment.specialty] || [];
    const generalItems = defaults['General'] || [];

    // Merge items, custom items take precedence
    const allItems = [];
    const addedIds = new Set();

    // Add custom items first
    customItems.forEach(item => {
        allItems.push({
            ...item,
            isCompleted: completedItems.includes(item.id.toString())
        });
        addedIds.add(item.id.toString());
    });

    // Add specialty-specific items
    specialtyItems.forEach(item => {
        if (!addedIds.has(item.id)) {
            allItems.push({
                ...item,
                isCompleted: completedItems.includes(item.id)
            });
            addedIds.add(item.id);
        }
    });

    // Add general items
    generalItems.forEach(item => {
        if (!addedIds.has(item.id)) {
            allItems.push({
                ...item,
                isCompleted: completedItems.includes(item.id)
            });
            addedIds.add(item.id);
        }
    });

    return {
        appointment: {
            id: appointment.id,
            doctorName: appointment.doctor_name,
            specialty: appointment.specialty,
            date: appointment.appointment_date,
            time: appointment.appointment_time,
            reason: appointment.reason
        },
        items: allItems,
        completedCount: allItems.filter(i => i.isCompleted).length,
        totalCount: allItems.length,
        requiredCount: allItems.filter(i => i.priority === 'required').length,
        requiredCompletedCount: allItems.filter(i => i.priority === 'required' && i.isCompleted).length
    };
};

/**
 * Mark prep item as completed
 */
const markPrepComplete = async (appointmentId, patientId, itemId) => {
    try {
        await db.execute(`
            INSERT INTO patient_prep_completion (appointment_id, patient_id, item_id, completed_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE completed_at = NOW()
        `, [appointmentId, patientId, itemId]);
    } catch (err) {
        // Log but don't fail - table might not exist
        console.log('Prep completion save note:', err.message);
    }

    return { success: true, itemId, completedAt: new Date() };
};

/**
 * Mark prep item as incomplete
 */
const markPrepIncomplete = async (appointmentId, patientId, itemId) => {
    try {
        await db.execute(`
            DELETE FROM patient_prep_completion 
            WHERE appointment_id = ? AND patient_id = ? AND item_id = ?
        `, [appointmentId, patientId, itemId]);
    } catch (err) {
        console.log('Prep uncompletion note:', err.message);
    }

    return { success: true, itemId };
};

/**
 * Add custom prep item (doctor)
 */
const addCustomPrepItem = async (doctorId, appointmentId, item) => {
    // Verify doctor owns the appointment
    const [appointments] = await db.execute(`
        SELECT id FROM appointments WHERE id = ? AND doctor_id = ?
    `, [appointmentId, doctorId]);

    if (appointments.length === 0) {
        throw new Error('Appointment not found or access denied');
    }

    const [result] = await db.execute(`
        INSERT INTO appointment_prep_items 
        (appointment_id, label, priority, icon, notes, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        appointmentId,
        item.label,
        item.priority || 'recommended',
        item.icon || '📋',
        item.notes || null,
        item.displayOrder || 99
    ]);

    return { id: result.insertId, ...item };
};

/**
 * Get patient's upcoming appointments with prep status
 */
const getPatientPrepOverview = async (patientId) => {
    const [appointments] = await db.execute(`
        SELECT a.id, a.appointment_date, a.appointment_time, a.reason,
            CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
            dp.specialty
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN doctor_profiles dp ON d.id = dp.doctor_id
        WHERE a.patient_id = ?
        AND DATE(a.appointment_date) >= CURDATE()
        AND a.status IN ('scheduled', 'confirmed')
        ORDER BY a.appointment_date, a.appointment_time
        LIMIT 10
    `, [patientId]);

    // Get prep status for each appointment
    const results = await Promise.all(appointments.map(async (apt) => {
        try {
            const prep = await getAppointmentPrep(apt.id, patientId);
            return {
                ...apt,
                prepProgress: {
                    completed: prep.completedCount,
                    total: prep.totalCount,
                    requiredCompleted: prep.requiredCompletedCount,
                    requiredTotal: prep.requiredCount,
                    percentage: prep.totalCount > 0 
                        ? Math.round((prep.completedCount / prep.totalCount) * 100) 
                        : 100
                }
            };
        } catch (err) {
            return {
                ...apt,
                prepProgress: { completed: 0, total: 0, percentage: 100 }
            };
        }
    }));

    return results;
};

/**
 * Get template prep items for a specialty (doctor use)
 */
const getSpecialtyPrepTemplate = (specialty) => {
    const defaults = getDefaultPrepItems();
    return {
        specialty,
        items: defaults[specialty] || defaults['General'],
        generalItems: defaults['General']
    };
};

/**
 * Send prep reminder (would integrate with notification service)
 */
const sendPrepReminder = async (appointmentId, patientId) => {
    const prep = await getAppointmentPrep(appointmentId, patientId);
    
    const incompleteRequired = prep.items.filter(i => i.priority === 'required' && !i.isCompleted);
    
    if (incompleteRequired.length === 0) {
        return { sent: false, message: 'All required items completed' };
    }

    // In production, this would send actual notification
    return {
        sent: true,
        message: `Reminder: ${incompleteRequired.length} required prep items pending`,
        items: incompleteRequired.map(i => i.label)
    };
};

module.exports = {
    getDefaultPrepItems,
    getAppointmentPrep,
    markPrepComplete,
    markPrepIncomplete,
    addCustomPrepItem,
    getPatientPrepOverview,
    getSpecialtyPrepTemplate,
    sendPrepReminder
};
