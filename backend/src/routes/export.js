const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/authenticate');
const exportService = require('../services/exportService');
const logger = require('../config/logger');

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Exporting user appointments to CSV and medical records to PDF
 */

// All export routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/export/appointments/csv:
 *   get:
 *     summary: Download appointment history as CSV
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file download containing patient's appointments
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       404:
 *         description: No records found
 *       500:
 *         description: Failed to export CSV
 */
router.get('/appointments/csv', async (req, res) => {
    try {
        const csv = await exportService.exportAppointmentsCSV(req.user.id);
        if (!csv) return res.status(404).json({ message: 'No records found' });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=appointments_${req.user.id}.csv`);
        res.send(csv);
    } catch (error) {
        logger.error(error);
        res.status(500).json({ message: 'Failed to export CSV' });
    }
});

/**
 * @swagger
 * /api/export/medical-record/pdf:
 *   get:
 *     summary: Download medical record summary as PDF
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF file stream containing patient's medical record summary
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Failed to generate PDF
 */
router.get('/medical-record/pdf', async (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=medical_record_${req.user.id}.pdf`);
        
        await exportService.exportMedicalRecordPDF(req.user.id, res);
    } catch (error) {
        logger.error(error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF' });
        }
    }
});

module.exports = router;
