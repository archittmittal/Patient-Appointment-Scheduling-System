const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/authenticate');
const fhirService = require('../services/fhirService');

/**
 * @swagger
 * tags:
 *   name: Prescriptions
 *   description: Digital prescriptions and medical records export APIs
 */

/**
 * @swagger
 * /api/prescriptions/{id}/fhir:
 *   get:
 *     summary: Export prescription and vitals as HL7 FHIR R4 Bundle
 *     description: Fetches a prescription by ID, grabs the patient and their latest vitals, and returns a compliant HL7 FHIR R4 Bundle.
 *     tags: [Prescriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Prescription ID
 *     responses:
 *       200:
 *         description: Successfully generated FHIR Bundle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (consent required or unauthorized role)
 *       404:
 *         description: Prescription not found
 *       500:
 *         description: Server error
 */
router.get('/:id/fhir', authenticate, async (req, res) => {
    try {
        const prescriptionId = req.params.id;

        // 1. Fetch prescription
        const [prescriptionRows] = await db.query(
            `SELECT * FROM prescriptions WHERE id = ?`,
            [prescriptionId]
        );
        const prescription = prescriptionRows[0];
        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        const patientId = prescription.patient_id;

        // 2. Check permission / consent (DPDP Act 2023 Compliance)
        let hasAccess = false;
        if (req.user.role === 'ADMIN' || (req.user.role === 'PATIENT' && req.user.id == patientId)) {
            hasAccess = true;
        } else if (req.user.role === 'DOCTOR') {
            // Check DPDP consent logs for the active doctor
            const [consentRows] = await db.query(
                `SELECT status FROM consent_logs 
                 WHERE patient_id = ? AND doctor_id = ? 
                 ORDER BY created_at DESC LIMIT 1`,
                [patientId, req.user.id]
            );
            if (consentRows.length > 0 && consentRows[0].status === 'GRANTED') {
                hasAccess = true;
            } else {
                return res.status(403).json({ 
                    status: 'fail',
                    message: 'Access denied: Patient consent is required to access these medical records.',
                    code: 'CONSENT_REQUIRED'
                });
            }
        }

        if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // 3. Fetch patient details (joining with users for email)
        const [patientRows] = await db.query(
            `SELECT p.*, u.email FROM patients p JOIN users u ON p.id = u.id WHERE p.id = ?`,
            [patientId]
        );
        const patient = patientRows[0];

        // 4. Fetch linked vitals (the latest recorded vitals for this patient)
        const [vitalsRows] = await db.query(
            `SELECT * FROM patient_vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1`,
            [patientId]
        );
        const vitals = vitalsRows[0] || null;

        // 5. Build FHIR Bundle
        const fhirBundle = fhirService.toFhirBundle(prescription, vitals, patient);

        return res.json(fhirBundle);
    } catch (error) {
        console.error('[FHIR Export Route Error]', error);
        return res.status(500).json({ message: 'Server error generating FHIR bundle' });
    }
});

module.exports = router;
