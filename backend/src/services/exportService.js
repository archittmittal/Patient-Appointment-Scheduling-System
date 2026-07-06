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

    /**
     * Export Full Clinical Profile as JSON
     */
    async exportFullClinicalProfileJSON(patientId) {
        // 1. Fetch patient profile
        const [profileRows] = await db.query(
            `SELECT p.id, p.first_name, p.last_name, p.dob, p.phone, p.blood_group, p.address, p.abha_id, p.abha_number, u.email 
             FROM patients p 
             JOIN users u ON p.id = u.id 
             WHERE p.id = ?`, 
            [patientId]
        );
        if (profileRows.length === 0) return null;
        const profile = profileRows[0];

        // Fetch remaining datasets in parallel
        const [
            [appointments],
            [prescriptions],
            [vitals],
            [consentLogs]
        ] = await Promise.all([
            db.query(
                `SELECT a.id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot, a.symptoms, a.status, a.diagnosis, a.notes, a.prescription, DATE_FORMAT(a.follow_up_date, '%Y-%m-%d') AS follow_up_date,
                        d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialty
                 FROM appointments a
                 JOIN doctors d ON a.doctor_id = d.id
                 WHERE a.patient_id = ?
                 ORDER BY a.appointment_date DESC`,
                [patientId]
            ),
            db.query(
                `SELECT p.id, DATE_FORMAT(p.date_prescribed, '%Y-%m-%d') AS date_prescribed, p.medications, p.dosage, p.frequency, p.duration_days, p.instructions, p.is_active,
                        d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialty
                 FROM prescriptions p
                 JOIN doctors d ON p.doctor_id = d.id
                 WHERE p.patient_id = ?
                 ORDER BY p.date_prescribed DESC`,
                [patientId]
            ),
            db.query(
                `SELECT id, weight_kg, height_cm, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature_c, spo2, DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i:%s') AS recorded_at
                 FROM patient_vitals
                 WHERE patient_id = ?
                 ORDER BY recorded_at DESC`,
                [patientId]
            ),
            db.query(
                `SELECT c.id, c.status, DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                        d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.specialty
                 FROM consent_logs c
                 JOIN doctors d ON c.doctor_id = d.id
                 WHERE c.patient_id = ?
                 ORDER BY c.created_at DESC`,
                [patientId]
            )
        ]);

        return {
            exported_at: new Date().toISOString(),
            profile,
            appointments,
            prescriptions,
            vitals,
            consentLogs
        };
    }

    /**
     * Export Full Clinical Profile as CSV
     */
    async exportFullClinicalProfileCSV(patientId) {
        const [profileRows] = await db.query(
            `SELECT p.first_name, p.last_name, p.dob, p.phone, p.blood_group, p.address, p.abha_id, p.abha_number, u.email 
             FROM patients p 
             JOIN users u ON p.id = u.id 
             WHERE p.id = ?`, 
            [patientId]
        );
        if (profileRows.length === 0) return null;
        const profile = profileRows[0];

        // Fetch remaining datasets in parallel
        const [
            [appointments],
            [prescriptions],
            [vitals],
            [consentLogs]
        ] = await Promise.all([
            db.query(
                `SELECT DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date, a.time_slot, a.symptoms, a.status, a.diagnosis, a.notes, a.prescription, DATE_FORMAT(a.follow_up_date, '%Y-%m-%d') AS follow_up_date,
                        d.first_name as doctor_first, d.last_name as doctor_last, d.specialty
                 FROM appointments a
                 JOIN doctors d ON a.doctor_id = d.id
                 WHERE a.patient_id = ?
                 ORDER BY a.appointment_date DESC`,
                [patientId]
            ),
            db.query(
                `SELECT DATE_FORMAT(p.date_prescribed, '%Y-%m-%d') AS date_prescribed, p.medications, p.dosage, p.frequency, p.duration_days, p.instructions, p.is_active,
                        d.first_name as doctor_first, d.last_name as doctor_last, d.specialty
                 FROM prescriptions p
                 JOIN doctors d ON p.doctor_id = d.id
                 WHERE p.patient_id = ?
                 ORDER BY p.date_prescribed DESC`,
                [patientId]
            ),
            db.query(
                `SELECT weight_kg, height_cm, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature_c, spo2, DATE_FORMAT(recorded_at, '%Y-%m-%d %H:%i:%s') AS recorded_at
                 FROM patient_vitals
                 WHERE patient_id = ?
                 ORDER BY recorded_at DESC`,
                [patientId]
            ),
            db.query(
                `SELECT c.status, DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                        d.first_name as doctor_first, d.last_name as doctor_last, d.specialty
                 FROM consent_logs c
                 JOIN doctors d ON c.doctor_id = d.id
                 WHERE c.patient_id = ?
                 ORDER BY c.created_at DESC`,
                [patientId]
            )
        ]);

        const patientBase = {
            patient_first_name: profile.first_name,
            patient_last_name: profile.last_name,
            patient_dob: profile.dob ? new Date(profile.dob).toISOString().split('T')[0] : 'N/A',
            patient_phone: profile.phone || 'N/A',
            patient_blood_group: profile.blood_group || 'N/A',
            patient_abha_id: profile.abha_id || 'N/A',
            patient_abha_number: profile.abha_number || 'N/A',
            patient_email: profile.email
        };

        const flatRows = [];

        // 1. Profile entry
        flatRows.push({
            ...patientBase,
            record_type: 'PROFILE',
            details: `Address: ${profile.address || 'N/A'}`,
            date: 'N/A',
            doctor: 'N/A',
            additional_info: 'N/A'
        });

        // 2. Appointments
        appointments.forEach(app => {
            flatRows.push({
                ...patientBase,
                record_type: 'APPOINTMENT',
                details: `Symptoms: ${app.symptoms || 'N/A'}, Diagnosis: ${app.diagnosis || 'N/A'}, Notes: ${app.notes || 'N/A'}, Status: ${app.status}`,
                date: app.appointment_date || 'N/A',
                doctor: `Dr. ${app.doctor_first} ${app.doctor_last} (${app.specialty})`,
                additional_info: `Prescription: ${app.prescription || 'N/A'}, Follow-up: ${app.follow_up_date || 'N/A'}`
            });
        });

        // 3. Prescriptions
        prescriptions.forEach(rx => {
            flatRows.push({
                ...patientBase,
                record_type: 'PRESCRIPTION',
                details: `Medications: ${rx.medications}, Dosage: ${rx.dosage || 'N/A'}, Frequency: ${rx.frequency || 'N/A'}, Duration: ${rx.duration_days ? rx.duration_days + ' days' : 'N/A'}`,
                date: rx.date_prescribed || 'N/A',
                doctor: `Dr. ${rx.doctor_first} ${rx.doctor_last} (${rx.specialty})`,
                additional_info: `Active: ${rx.is_active ? 'Yes' : 'No'}, Instructions: ${rx.instructions || 'N/A'}`
            });
        });

        // 4. Vitals
        vitals.forEach(v => {
            flatRows.push({
                ...patientBase,
                record_type: 'VITAL_RECORD',
                details: `Weight: ${v.weight_kg ? v.weight_kg + 'kg' : 'N/A'}, Height: ${v.height_cm ? v.height_cm + 'cm' : 'N/A'}, BP: ${v.blood_pressure_sys || 'N/A'}/${v.blood_pressure_dia || 'N/A'} mmHg`,
                date: v.recorded_at || 'N/A',
                doctor: 'N/A',
                additional_info: `HR: ${v.heart_rate ? v.heart_rate + ' bpm' : 'N/A'}, Temp: ${v.temperature_c ? v.temperature_c + 'C' : 'N/A'}, SpO2: ${v.spo2 ? v.spo2 + '%' : 'N/A'}`
            });
        });

        // 5. Consent Logs
        consentLogs.forEach(c => {
            flatRows.push({
                ...patientBase,
                record_type: 'CONSENT_LOG',
                details: `Consent Status: ${c.status}`,
                date: c.created_at || 'N/A',
                doctor: `Dr. ${c.doctor_first} ${c.doctor_last} (${c.specialty})`,
                additional_info: 'N/A'
            });
        });

        const fields = [
            'patient_first_name', 'patient_last_name', 'patient_dob', 'patient_phone', 'patient_blood_group', 
            'patient_abha_id', 'patient_abha_number', 'patient_email', 'record_type', 'details', 'date', 'doctor', 'additional_info'
        ];

        const json2csvParser = new Parser({ fields });
        return json2csvParser.parse(flatRows);
    }
}

module.exports = new ExportService();
