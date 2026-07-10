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
                a.follow_up_date,
                p.id AS patient_id,
                p.first_name AS patient_first,
                p.last_name AS patient_last,
                p.dob AS patient_dob,
                p.phone AS patient_phone,
                p.blood_group AS patient_blood_group,
                p.abha_number,
                d.id AS doctor_id,
                d.first_name AS doctor_first,
                d.last_name AS doctor_last,
                d.specialty AS doctor_specialty,
                d.location_room,
                v.blood_pressure,
                v.heart_rate,
                v.temperature,
                v.spo2,
                v.weight_kg
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN live_queue lq ON a.id = lq.appointment_id
            LEFT JOIN vitals v ON lq.id = v.queue_id
            WHERE a.id = ?
        `;
        const [rows] = await db.query(query, [appointmentId]);
        if (rows.length === 0) throw new Error('Appointment not found');
        const data = rows[0];

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        // 1. Top Decorative Brand Bar
        doc.rect(40, 40, 515, 6).fill('#0891b2');

        // 2. Hospital / Clinic Info
        doc.fontSize(16).fillColor('#0f172a').text('HEALTHSYNC MEDICAL CENTER', 40, 56, { bold: true });
        doc.fontSize(8).fillColor('#64748b').text('Multi-Speciality OPD Care & Clinical Portal', 40, 76);
        doc.text('Helpline: +91 98765 43210 | info@healthsync.com | www.healthsync.com', 40, 88);

        // 3. Doctor Details (Right-aligned)
        const doctorName = `Dr. ${data.doctor_first} ${data.doctor_last}`;
        doc.fontSize(11).fillColor('#0f172a').text(doctorName, 350, 56, { align: 'right', bold: true });
        doc.fontSize(8).fillColor('#0891b2').text(data.doctor_specialty || 'General Practitioner', 350, 70, { align: 'right' });
        doc.fontSize(8).fillColor('#64748b').text(`Cabin: ${data.location_room || 'N/A'} | Reg No: HS-DOC-${data.doctor_id}`, 350, 82, { align: 'right' });

        // 4. Accent Divider Line
        doc.moveTo(40, 108).lineTo(555, 108).strokeColor('#e2e8f0').lineWidth(1).stroke();

        // 5. Patient Information Box (Bordered Grid)
        doc.rect(40, 118, 515, 54).fill('#f8fafc').stroke('#e2e8f0');

        // Helper to calculate age
        const calculateAge = (dobString) => {
            if (!dobString) return 'N/A';
            try {
                const today = new Date();
                const birthDate = new Date(dobString);
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                return `${age} Yrs`;
            } catch {
                return 'N/A';
            }
        };

        // Patient Details Row 1
        doc.fontSize(8).fillColor('#64748b').text('PATIENT ID:', 50, 126);
        doc.fontSize(9).fillColor('#0f172a').text(`PAT-${data.patient_id}`, 115, 126, { bold: true });

        doc.fontSize(8).fillColor('#64748b').text('DATE:', 235, 126);
        doc.fontSize(9).fillColor('#0f172a').text(data.appointment_date, 280, 126);

        doc.fontSize(8).fillColor('#64748b').text('AGE / DOB:', 405, 126);
        doc.fontSize(9).fillColor('#0f172a').text(`${calculateAge(data.patient_dob)} (${data.patient_dob ? new Date(data.patient_dob).toLocaleDateString() : 'N/A'})`, 465, 126);

        // Patient Details Row 2
        doc.fontSize(8).fillColor('#64748b').text('PATIENT NAME:', 50, 139);
        doc.fontSize(9).fillColor('#0f172a').text(`${data.patient_first} ${data.patient_last}`, 115, 139, { bold: true });

        doc.fontSize(8).fillColor('#64748b').text('PHONE:', 235, 139);
        doc.fontSize(9).fillColor('#0f172a').text(data.patient_phone || 'N/A', 280, 139);

        doc.fontSize(8).fillColor('#64748b').text('BLOOD GROUP:', 405, 139);
        doc.fontSize(9).fillColor('#ef4444').text(data.patient_blood_group || 'N/A', 465, 139, { bold: true });

        // Patient Details Row 3
        doc.fontSize(8).fillColor('#64748b').text('ABHA NO:', 50, 152);
        doc.fontSize(9).fillColor('#0f172a').text(data.abha_number || 'N/A', 115, 152);

        doc.fontSize(8).fillColor('#64748b').text('PRESCRIPTION:', 235, 152);
        doc.fontSize(9).fillColor('#0f172a').text(`OPD-SLIP-${data.appointment_id}`, 280, 152);

        // 6. Layout Columns Setup (Left Sidebar / Right Main Area)
        // Vertical Divider line separating side column from prescriptions
        doc.moveTo(180, 182).lineTo(180, 680).strokeColor('#e2e8f0').lineWidth(1).stroke();

        // 7. Left Sidebar: Clinical Vitals & Complaints
        doc.fontSize(10).fillColor('#0f172a').text('CLINICAL VITALS', 40, 186, { bold: true });
        
        let vitalsY = 202;
        const addVitalField = (label, val, unit) => {
            doc.fontSize(7.5).fillColor('#64748b').text(label, 40, vitalsY);
            doc.fontSize(9).fillColor('#0f172a').text(`${val || '—'} ${unit}`, 40, vitalsY + 9, { bold: true });
            vitalsY += 26;
        };
        addVitalField('Blood Pressure', data.blood_pressure, 'mmHg');
        addVitalField('Pulse Rate', data.heart_rate, 'bpm');
        addVitalField('Body Temp', data.temperature, '°C');
        addVitalField('SpO2', data.spo2, '%');
        addVitalField('Body Weight', data.weight_kg, 'kg');

        // Chief Complaints
        doc.fontSize(10).fillColor('#0f172a').text('CHIEF COMPLAINTS', 40, 345, { bold: true });
        doc.fontSize(8.5).fillColor('#334155').text(data.symptoms || 'Routine clinical check-up', 40, 360, {
            width: 130,
            lineGap: 3
        });

        // 8. Right Main Area: Diagnosis, Rx, Advice
        // Clinical Diagnosis
        doc.fontSize(10).fillColor('#0f172a').text('CLINICAL DIAGNOSIS', 195, 186, { bold: true });
        doc.fontSize(9).fillColor('#334155').text(data.diagnosis || 'General wellness / OPD follow-up', 195, 199, {
            width: 360,
            lineGap: 3
        });

        // Rx Section
        doc.fontSize(18).fillColor('#0891b2').text('Rx', 195, 235, { bold: true });
        
        let rxY = 260;
        if (data.prescription) {
            const medLines = data.prescription.split('\n').map(l => l.trim()).filter(Boolean);
            medLines.forEach((line, index) => {
                doc.fontSize(8.5).fillColor('#64748b').text(`${index + 1}.`, 195, rxY);
                doc.fontSize(9.5).fillColor('#0f172a').text(line, 210, rxY, { bold: true, width: 345 });
                const height = doc.heightOfString(line, { width: 345 });
                rxY += Math.max(height + 10, 20);
            });
        } else {
            doc.fontSize(9).fillColor('#64748b').text('No active medications prescribed.', 210, rxY, { italic: true });
            rxY += 20;
        }

        // Advice and Instructions
        let adviceY = Math.max(rxY + 15, 450);
        doc.fontSize(10).fillColor('#0f172a').text('ADVICE / CLINICAL INSTRUCTIONS', 195, adviceY, { bold: true });
        doc.fontSize(8.5).fillColor('#334155').text(data.notes || 'Take prescribed medications as per schedule. Ensure proper rest and hydration.', 195, adviceY + 13, {
            width: 360,
            lineGap: 3
        });

        // Follow-up consultation date
        if (data.follow_up_date) {
            const followUpStr = new Date(data.follow_up_date).toLocaleDateString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
            });
            doc.fontSize(9).fillColor('#0891b2').text(`Next Follow-up Consultation: ${followUpStr}`, 195, adviceY + 120, { bold: true });
        }

        // 9. Footer & Doctor Signature
        doc.fontSize(8.5).fillColor('#64748b').text("Doctor's Signature / Seal", 400, 646, { align: 'center' });
        doc.moveTo(400, 642).lineTo(540, 642).strokeColor('#cbd5e1').lineWidth(1).stroke();

        doc.rect(40, 710, 515, 18).fill('#f1f5f9');
        doc.fontSize(7.5).fillColor('#64748b').text('This is an electronically generated and validated clinical document. No physical signature is required.', 40, 715, { align: 'center', width: 515 });

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
