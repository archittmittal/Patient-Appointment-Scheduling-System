const db = require('../config/db');

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
                p.instructions,
                p.appointment_id,
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
     * Create a new prescription
     */
    async createPrescription(doctorId, patientId, medications, instructions, appointmentId = null, conn = null) {
        const executor = conn || db;
        const query = `
            INSERT INTO prescriptions (doctor_id, patient_id, medications, instructions, appointment_id, date_prescribed)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await executor.query(query, [doctorId, patientId, medications, instructions, appointmentId]);
        return { id: result.insertId, status: 'created' };
    }
}

module.exports = new PrescriptionService();
