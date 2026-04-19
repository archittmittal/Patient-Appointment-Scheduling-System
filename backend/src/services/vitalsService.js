const db = require('../config/db');

class VitalsService {
    /**
     * Fetch vitals history for a specific patient
     */
    async getPatientVitals(patientId, conn = null) {
        const executor = conn || db;
        const query = `
            SELECT 
                id,
                weight_kg,
                height_cm,
                blood_pressure_sys,
                blood_pressure_dia,
                heart_rate,
                temperature_c,
                recorded_at
            FROM patient_vitals
            WHERE patient_id = ?
            ORDER BY recorded_at ASC
        `;
        const [rows] = await executor.query(query, [patientId]);
        return rows;
    }

    /**
     * Log new vitals for a patient
     */
    async logVitals(patientId, vitalsData, conn = null) {
        const executor = conn || db;
        const { weight_kg, height_cm, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature_c } = vitalsData;
        const query = `
            INSERT INTO patient_vitals (
                patient_id, weight_kg, height_cm, 
                blood_pressure_sys, blood_pressure_dia, 
                heart_rate, temperature_c, recorded_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await executor.query(query, [
            patientId, weight_kg, height_cm, 
            blood_pressure_sys, blood_pressure_dia, 
            heart_rate, temperature_c
        ]);
        return { id: result.insertId, status: 'logged' };
    }
}

module.exports = new VitalsService();
