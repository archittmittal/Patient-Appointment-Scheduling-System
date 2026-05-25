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

    /**
     * Export a specific Prescription as a PDF
     */
    async generatePrescriptionPDF(appointmentId, res) {
        const query = `
            SELECT 
                a.id AS appointment_id,
                DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
                a.prescription,
                a.diagnosis,
                a.notes,
                p.first_name AS patient_first,
                p.last_name AS patient_last,
                p.dob AS patient_dob,
                p.phone AS patient_phone,
                d.first_name AS doctor_first,
                d.last_name AS doctor_last,
                d.specialty AS doctor_specialty,
                d.location_room
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.id = ?
        `;
        const [rows] = await db.query(query, [appointmentId]);
        if (rows.length === 0) throw new Error('Appointment not found');
        const data = rows[0];

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // Header and branding style
        doc.fontSize(24).fillColor('#4f46e5').text('HEALTHSYNC PREMIUM', { align: 'center', underline: true });
        doc.fontSize(10).fillColor('#64748b').text('Clinical Orchestration Engine & Medical Portal', { align: 'center' });
        doc.moveDown(2);

        // Doctor & Clinic Info (Left side)
        const doctorName = `Dr. ${data.doctor_first} ${data.doctor_last}`;
        doc.fontSize(14).fillColor('#1e293b').text(doctorName, { bold: true });
        doc.fontSize(10).fillColor('#64748b').text(data.doctor_specialty || 'General Practitioner');
        doc.text(`Medical Center - Room ${data.location_room || 'N/A'}`);
        doc.moveDown();

        // Right side alignment (simulated via absolute coordinates or Y-resets)
        doc.y = 110; 
        doc.fontSize(10).fillColor('#64748b').text(`Date: ${data.appointment_date}`, { align: 'right' });
        doc.text(`Prescription ID: PR-${data.appointment_id}`, { align: 'right' });
        doc.moveDown(2);

        doc.y = 180; // move below header block

        // Divider
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown();

        // Patient Info
        doc.fontSize(12).fillColor('#1e293b').text('PATIENT INFORMATION', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#334155').text(`Name: ${data.patient_first} ${data.patient_last}`);
        doc.text(`DOB: ${data.patient_dob ? new Date(data.patient_dob).toLocaleDateString() : 'N/A'}`);
        doc.text(`Phone: ${data.patient_phone || 'N/A'}`);
        doc.moveDown(2);

        // Diagnosis
        doc.fontSize(12).fillColor('#1e293b').text('CLINICAL DIAGNOSIS', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#334155').text(data.diagnosis || 'General check-up / consultation notes');
        doc.moveDown(2);

        // Prescription/Medicines
        doc.fontSize(12).fillColor('#1e293b').text('PRESCRIBED MEDICATIONS', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(12).fillColor('#4f46e5').text(data.prescription || 'No medications prescribed during this session.', {
            indent: 10,
            lineGap: 4
        });
        doc.moveDown(2);

        // Clinical / Private Notes
        if (data.notes) {
            doc.fontSize(12).fillColor('#1e293b').text('INSTRUCTIONS / CLINICAL NOTES', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).fillColor('#334155').text(data.notes);
            doc.moveDown(2);
        }

        // Footer
        doc.y = 700; 
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor('#94a3b8').text('This is a secure, electronically verified prescription document from HealthSync.', { align: 'center' });
        doc.text('Verification and security powered by JWT credentials.', { align: 'center' });

        doc.end();
    }
}

module.exports = new ExportService();
