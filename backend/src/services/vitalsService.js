const db = require('../config/db');

/**
 * Vitals Thresholds for abnormal detection (Issue #144)
 */
const VITALS_THRESHOLDS = {
    heart_rate: { low: 50, high: 120, normal_low: 60, normal_high: 100 },
    blood_pressure_sys: { high: 160, normal_high: 140 },
    blood_pressure_dia: { high: 100, normal_high: 90 },
    temperature_c: { high: 38.5, normal_low: 36.5, normal_high: 37.5 },
    spo2: { low: 92, normal_low: 95 }
};

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
                spo2,
                recorded_at,
                recorded_by
            FROM patient_vitals
            WHERE patient_id = ?
            ORDER BY recorded_at ASC
        `;
        const [rows] = await executor.query(query, [patientId]);
        return rows;
    }

    /**
     * Log new vitals for a patient
     * Returns result with abnormal alerts if any readings are outside thresholds
     */
    async logVitals(patientId, vitalsData, recordedBy = null, conn = null) {
        const executor = conn || db;
        const { weight_kg, height_cm, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature_c, spo2 } = vitalsData;

        // Check for abnormal values before logging
        const alerts = this.checkAbnormalValues(vitalsData);

        const query = `
            INSERT INTO patient_vitals (
                patient_id, weight_kg, height_cm, 
                blood_pressure_sys, blood_pressure_dia, 
                heart_rate, temperature_c, spo2, recorded_by, recorded_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await executor.query(query, [
            patientId, weight_kg || null, height_cm || null, 
            blood_pressure_sys || null, blood_pressure_dia || null, 
            heart_rate || null, temperature_c || null, spo2 || null, recordedBy
        ]);

        return {
            id: result.insertId,
            status: 'logged',
            alerts: alerts.length > 0 ? alerts : undefined
        };
    }

    /**
     * Check vitals against thresholds and return alerts for abnormal values
     */
    checkAbnormalValues(vitalsData) {
        const alerts = [];

        if (vitalsData.heart_rate != null) {
            if (vitalsData.heart_rate < VITALS_THRESHOLDS.heart_rate.low) {
                alerts.push({ field: 'heart_rate', value: vitalsData.heart_rate, severity: 'critical', message: `Bradycardia: HR ${vitalsData.heart_rate} bpm (critical < ${VITALS_THRESHOLDS.heart_rate.low})` });
            } else if (vitalsData.heart_rate > VITALS_THRESHOLDS.heart_rate.high) {
                alerts.push({ field: 'heart_rate', value: vitalsData.heart_rate, severity: 'critical', message: `Tachycardia: HR ${vitalsData.heart_rate} bpm (critical > ${VITALS_THRESHOLDS.heart_rate.high})` });
            } else if (vitalsData.heart_rate < VITALS_THRESHOLDS.heart_rate.normal_low || vitalsData.heart_rate > VITALS_THRESHOLDS.heart_rate.normal_high) {
                alerts.push({ field: 'heart_rate', value: vitalsData.heart_rate, severity: 'warning', message: `Abnormal HR: ${vitalsData.heart_rate} bpm (normal: ${VITALS_THRESHOLDS.heart_rate.normal_low}-${VITALS_THRESHOLDS.heart_rate.normal_high})` });
            }
        }

        if (vitalsData.blood_pressure_sys != null) {
            if (vitalsData.blood_pressure_sys > VITALS_THRESHOLDS.blood_pressure_sys.high) {
                alerts.push({ field: 'blood_pressure_sys', value: vitalsData.blood_pressure_sys, severity: 'critical', message: `Hypertensive Crisis: SBP ${vitalsData.blood_pressure_sys} mmHg (critical > ${VITALS_THRESHOLDS.blood_pressure_sys.high})` });
            } else if (vitalsData.blood_pressure_sys > VITALS_THRESHOLDS.blood_pressure_sys.normal_high) {
                alerts.push({ field: 'blood_pressure_sys', value: vitalsData.blood_pressure_sys, severity: 'warning', message: `Elevated BP: SBP ${vitalsData.blood_pressure_sys} mmHg (normal < ${VITALS_THRESHOLDS.blood_pressure_sys.normal_high})` });
            }
        }

        if (vitalsData.blood_pressure_dia != null) {
            if (vitalsData.blood_pressure_dia > VITALS_THRESHOLDS.blood_pressure_dia.high) {
                alerts.push({ field: 'blood_pressure_dia', value: vitalsData.blood_pressure_dia, severity: 'critical', message: `Hypertensive Crisis: DBP ${vitalsData.blood_pressure_dia} mmHg (critical > ${VITALS_THRESHOLDS.blood_pressure_dia.high})` });
            } else if (vitalsData.blood_pressure_dia > VITALS_THRESHOLDS.blood_pressure_dia.normal_high) {
                alerts.push({ field: 'blood_pressure_dia', value: vitalsData.blood_pressure_dia, severity: 'warning', message: `Elevated BP: DBP ${vitalsData.blood_pressure_dia} mmHg (normal < ${VITALS_THRESHOLDS.blood_pressure_dia.normal_high})` });
            }
        }

        if (vitalsData.temperature_c != null) {
            if (vitalsData.temperature_c > VITALS_THRESHOLDS.temperature_c.high) {
                alerts.push({ field: 'temperature_c', value: vitalsData.temperature_c, severity: 'critical', message: `Fever: ${vitalsData.temperature_c}°C (critical > ${VITALS_THRESHOLDS.temperature_c.high})` });
            } else if (vitalsData.temperature_c < VITALS_THRESHOLDS.temperature_c.normal_low || vitalsData.temperature_c > VITALS_THRESHOLDS.temperature_c.normal_high) {
                alerts.push({ field: 'temperature_c', value: vitalsData.temperature_c, severity: 'warning', message: `Abnormal temp: ${vitalsData.temperature_c}°C (normal: ${VITALS_THRESHOLDS.temperature_c.normal_low}-${VITALS_THRESHOLDS.temperature_c.normal_high})` });
            }
        }

        if (vitalsData.spo2 != null) {
            if (vitalsData.spo2 < VITALS_THRESHOLDS.spo2.low) {
                alerts.push({ field: 'spo2', value: vitalsData.spo2, severity: 'critical', message: `Hypoxia: SpO2 ${vitalsData.spo2}% (critical < ${VITALS_THRESHOLDS.spo2.low})` });
            } else if (vitalsData.spo2 < VITALS_THRESHOLDS.spo2.normal_low) {
                alerts.push({ field: 'spo2', value: vitalsData.spo2, severity: 'warning', message: `Low oxygen: SpO2 ${vitalsData.spo2}% (normal > ${VITALS_THRESHOLDS.spo2.normal_low})` });
            }
        }

        return alerts;
    }

    /**
     * Get vitals trends for a patient over time
     * Returns averages grouped by week/month for trend analysis
     */
    async getVitalsTrends(patientId, periodDays = 90, conn = null) {
        const executor = conn || db;

        // Weekly averages
        const [weeklyTrends] = await executor.query(`
            SELECT 
                YEARWEEK(recorded_at) as week,
                ROUND(AVG(heart_rate), 1) as avg_heart_rate,
                ROUND(AVG(blood_pressure_sys), 1) as avg_bp_sys,
                ROUND(AVG(blood_pressure_dia), 1) as avg_bp_dia,
                ROUND(AVG(temperature_c), 1) as avg_temp,
                ROUND(AVG(weight_kg), 1) as avg_weight,
                ROUND(AVG(spo2), 1) as avg_spo2,
                COUNT(*) as reading_count,
                MIN(recorded_at) as week_start,
                MAX(recorded_at) as week_end
            FROM patient_vitals
            WHERE patient_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY YEARWEEK(recorded_at)
            ORDER BY week ASC
        `, [patientId, periodDays]);

        // Latest vs previous reading comparison
        const [latestReadings] = await executor.query(`
            SELECT * FROM patient_vitals 
            WHERE patient_id = ? 
            ORDER BY recorded_at DESC LIMIT 2
        `, [patientId]);

        let comparison = null;
        if (latestReadings.length >= 2) {
            const [latest, previous] = latestReadings;
            comparison = {
                heart_rate: this._calcDelta(latest.heart_rate, previous.heart_rate),
                blood_pressure_sys: this._calcDelta(latest.blood_pressure_sys, previous.blood_pressure_sys),
                blood_pressure_dia: this._calcDelta(latest.blood_pressure_dia, previous.blood_pressure_dia),
                weight_kg: this._calcDelta(latest.weight_kg, previous.weight_kg),
                temperature_c: this._calcDelta(latest.temperature_c, previous.temperature_c),
                spo2: this._calcDelta(latest.spo2, previous.spo2)
            };
        }

        return {
            weeklyTrends,
            comparison,
            totalReadings: weeklyTrends.reduce((sum, w) => sum + w.reading_count, 0)
        };
    }

    /**
     * Calculate delta between two values
     */
    _calcDelta(current, previous) {
        if (current == null || previous == null) return null;
        const delta = current - previous;
        return {
            current,
            previous,
            delta: Math.round(delta * 100) / 100,
            direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable'
        };
    }
}

module.exports = new VitalsService();
module.exports.VITALS_THRESHOLDS = VITALS_THRESHOLDS;
