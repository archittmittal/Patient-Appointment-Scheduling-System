const db = require('../config/db');

/**
 * Known drug interaction database (stub for Issue #144)
 * In production, this would connect to an external drug interaction API
 */
const KNOWN_INTERACTIONS = {
    'warfarin+aspirin': { severity: 'high', message: 'Increased bleeding risk with concurrent use of Warfarin and Aspirin' },
    'metformin+contrast dye': { severity: 'high', message: 'Risk of lactic acidosis; hold Metformin 48h before contrast imaging' },
    'ssri+maoi': { severity: 'critical', message: 'Serotonin syndrome risk — CONTRAINDICATED combination' },
    'ace inhibitor+potassium': { severity: 'moderate', message: 'Monitor potassium levels — risk of hyperkalemia' },
    'statin+grapefruit': { severity: 'low', message: 'Grapefruit may increase statin levels — advise patient' }
};

class PrescriptionService {
    /**
     * Fetch all prescriptions for a specific patient
     * Includes doctor info and medication details
     */
    async getPatientPrescriptions(patientId, conn = null) {
        const executor = conn || db;
        const query = `
            SELECT 
                p.id,
                p.date_prescribed,
                p.medications,
                p.dosage,
                p.frequency,
                p.duration_days,
                p.instructions,
                p.appointment_id,
                p.refills_remaining,
                p.refill_date,
                p.is_active,
                d.first_name as doctor_first_name,
                d.last_name as doctor_last_name,
                d.specialty
            FROM prescriptions p
            JOIN doctors d ON p.doctor_id = d.id
            WHERE p.patient_id = ?
            ORDER BY p.date_prescribed DESC
        `;
        const [rows] = await executor.query(query, [patientId]);
        return rows;
    }

    /**
     * Create a new prescription with full validation
     */
    async createPrescription(doctorId, patientId, prescriptionData, appointmentId = null, conn = null) {
        const executor = conn || db;

        const {
            medications,
            dosage = null,
            frequency = null,
            duration_days = null,
            instructions = null,
            refills_remaining = 0
        } = prescriptionData;

        // Validate prescription data
        const validationErrors = this.validatePrescription(prescriptionData);
        if (validationErrors.length > 0) {
            return { success: false, errors: validationErrors };
        }

        // Check for drug interactions with existing active prescriptions
        const interactions = await this.checkDrugInteractions(patientId, medications, executor);

        const query = `
            INSERT INTO prescriptions 
                (doctor_id, patient_id, medications, dosage, frequency, duration_days, instructions, appointment_id, refills_remaining, is_active, date_prescribed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())
        `;
        const [result] = await executor.query(query, [
            doctorId, patientId, medications, dosage, frequency,
            duration_days, instructions, appointmentId, refills_remaining
        ]);

        return {
            id: result.insertId,
            status: 'created',
            interactions: interactions.length > 0 ? interactions : undefined
        };
    }

    /**
     * Validate prescription fields
     */
    validatePrescription(data) {
        const errors = [];

        if (!data.medications || data.medications.trim().length === 0) {
            errors.push('Medications field is required');
        }

        if (data.duration_days != null && (data.duration_days < 1 || data.duration_days > 365)) {
            errors.push('Duration must be between 1 and 365 days');
        }

        if (data.refills_remaining != null && (data.refills_remaining < 0 || data.refills_remaining > 12)) {
            errors.push('Refills must be between 0 and 12');
        }

        return errors;
    }

    /**
     * Check for drug interactions between new medication and existing active prescriptions
     * (Stub implementation — in production, use a real drug interaction API)
     */
    async checkDrugInteractions(patientId, newMedication, executor = null) {
        const db_exec = executor || db;
        const interactions = [];

        try {
            // Get all active prescriptions for this patient
            const [activePrescriptions] = await db_exec.query(
                'SELECT medications FROM prescriptions WHERE patient_id = ? AND is_active = TRUE',
                [patientId]
            );

            const newMeds = newMedication.toLowerCase().split(/[,\n;]+/).map(m => m.trim());
            
            for (const existing of activePrescriptions) {
                const existingMeds = existing.medications.toLowerCase().split(/[,\n;]+/).map(m => m.trim());

                for (const newMed of newMeds) {
                    for (const existingMed of existingMeds) {
                        // Check both orderings in the interaction database
                        const key1 = `${newMed}+${existingMed}`;
                        const key2 = `${existingMed}+${newMed}`;
                        const interaction = KNOWN_INTERACTIONS[key1] || KNOWN_INTERACTIONS[key2];
                        
                        if (interaction) {
                            interactions.push({
                                newMedication: newMed,
                                existingMedication: existingMed,
                                ...interaction
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error checking drug interactions:', error);
        }

        return interactions;
    }

    /**
     * Process a prescription refill
     */
    async processRefill(prescriptionId, doctorId, conn = null) {
        const executor = conn || db;

        const [prescriptionRows] = await executor.query(
            'SELECT * FROM prescriptions WHERE id = ?',
            [prescriptionId]
        );
        const prescription = prescriptionRows[0];

        if (!prescription) {
            return { success: false, error: 'Prescription not found' };
        }

        if (!prescription.is_active) {
            return { success: false, error: 'Prescription is no longer active' };
        }

        if (prescription.refills_remaining <= 0) {
            return { success: false, error: 'No refills remaining' };
        }

        await executor.query(
            'UPDATE prescriptions SET refills_remaining = refills_remaining - 1, refill_date = NOW() WHERE id = ?',
            [prescriptionId]
        );

        return {
            success: true,
            refillsRemaining: prescription.refills_remaining - 1,
            message: `Refill processed. ${prescription.refills_remaining - 1} refills remaining.`
        };
    }

    /**
     * Get prescription history for a patient (including inactive/expired)
     */
    async getPrescriptionHistory(patientId, conn = null) {
        const executor = conn || db;
        const [rows] = await executor.query(`
            SELECT 
                p.*,
                d.first_name as doctor_first_name,
                d.last_name as doctor_last_name,
                d.specialty,
                a.appointment_date
            FROM prescriptions p
            JOIN doctors d ON p.doctor_id = d.id
            LEFT JOIN appointments a ON p.appointment_id = a.id
            WHERE p.patient_id = ?
            ORDER BY p.date_prescribed DESC
        `, [patientId]);

        return {
            total: rows.length,
            active: rows.filter(r => r.is_active).length,
            prescriptions: rows
        };
    }

    /**
     * Deactivate a prescription (mark as expired/discontinued)
     */
    async deactivatePrescription(prescriptionId, doctorId, reason = 'discontinued', conn = null) {
        const executor = conn || db;
        const [result] = await executor.query(
            'UPDATE prescriptions SET is_active = FALSE WHERE id = ? AND doctor_id = ?',
            [prescriptionId, doctorId]
        );

        return {
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Prescription deactivated' : 'Prescription not found or unauthorized'
        };
    }
}

module.exports = new PrescriptionService();
