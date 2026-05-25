/**
 * Export Service
 * Generates downloadable reports in PDF and CSV formats.
 */

const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const db = require('../config/db');

class ExportService {
    /**
     * Export Appointment History as CSV
     */
    async exportAppointmentsCSV(patientId) {
        const [rows] = await db.query(`
            SELECT 
                a.appointment_date, a.time_slot, a.status, a.symptoms,
                d.first_name AS doctor_first, d.last_name AS doctor_last, d.specialty
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC
        `, [patientId]);

        if (rows.length === 0) return null;

        const fields = [
            { label: 'Date', value: 'appointment_date' },
            { label: 'Time', value: 'time_slot' },
            { label: 'Status', value: 'status' },
            { label: 'Symptoms', value: 'symptoms' },
            { label: 'Doctor', value: (row) => `Dr. ${row.doctor_first} ${row.doctor_last}` },
            { label: 'Specialty', value: 'specialty' }
        ];

        const json2csvParser = new Parser({ fields });
        return json2csvParser.parse(rows);
    }

    /**
     * Export Medical Record Summary as PDF
     */
    async exportMedicalRecordPDF(patientId, res) {
        // Fetch Patient Info
        const [patients] = await db.query('SELECT * FROM patients WHERE id = ?', [patientId]);
        if (patients.length === 0) throw new Error('Patient not found');
        const patient = patients[0];

        // Fetch Recent Vitals
        const [vitals] = await db.query(`
            SELECT v.*, a.appointment_date 
            FROM vitals v 
            JOIN live_queue lq ON v.queue_id = lq.id
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC LIMIT 5
        `, [patientId]);

        const doc = new PDFDocument({ margin: 50 });

        // Pipe PDF to response
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Medical Record Summary', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
        doc.moveDown();

        // Patient Details
        doc.fontSize(16).text('Patient Information', { underline: true });
        doc.fontSize(12).text(`Name: ${patient.first_name} ${patient.last_name}`);
        doc.text(`DOB: ${patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}`);
        doc.text(`Blood Group: ${patient.blood_group || 'N/A'}`);
        doc.text(`Phone: ${patient.phone || 'N/A'}`);
        doc.moveDown();

        // Vitals Section
        if (vitals.length > 0) {
            doc.fontSize(16).text('Recent Vitals', { underline: true });
            doc.moveDown(0.5);
            vitals.forEach((v, index) => {
                doc.fontSize(12).text(`${new Date(v.appointment_date).toLocaleDateString()}:`, { continued: true });
                doc.text(` BP: ${v.blood_pressure}, Heart Rate: ${v.heart_rate} bpm, Temp: ${v.temperature}°C, SpO2: ${v.spo2}%`);
            });
        } else {
            doc.text('No vital records found.');
        }

        doc.moveDown();
        doc.fontSize(10).fillColor('gray').text('This is a computer-generated summary. Please consult your doctor for medical advice.', { align: 'center' });

        doc.end();
    }

    /**
     * Export Patient Vitals as CSV (Streams directly to response)
     */
    async exportVitalsCSV(patientId, res) {
        const [rows] = await db.query(`
            SELECT 
                v.blood_pressure, v.heart_rate, v.temperature, v.spo2, v.weight_kg,
                lq.status AS queue_status,
                a.appointment_date, a.time_slot
            FROM vitals v
            JOIN live_queue lq ON v.queue_id = lq.id
            JOIN appointments a ON lq.appointment_id = a.id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC
        `, [patientId]);

        const fields = [
            { label: 'Date', value: 'appointment_date' },
            { label: 'Time', value: 'time_slot' },
            { label: 'BP (mmHg)', value: 'blood_pressure' },
            { label: 'Heart Rate (bpm)', value: 'heart_rate' },
            { label: 'Temp (C)', value: 'temperature' },
            { label: 'SpO2 (%)', value: 'spo2' },
            { label: 'Weight (kg)', value: 'weight_kg' }
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(rows);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=vitals_patient_${patientId}.csv`);
        res.status(200).send(csv);
    }
}

module.exports = new ExportService();
