const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/authenticate');
const exportService = require('../services/exportService');

// All export routes require authentication
router.use(authenticate);

/**
 * GET /api/export/appointments/csv
 * Download appointment history as CSV
 */
router.get('/appointments/csv', async (req, res) => {
    try {
        const csv = await exportService.exportAppointmentsCSV(req.user.id);
        if (!csv) return res.status(404).json({ message: 'No records found' });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=appointments_${req.user.id}.csv`);
        res.send(csv);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to export CSV' });
    }
});

/**
 * GET /api/export/medical-record/pdf
 * Download medical record as PDF
 */
router.get('/medical-record/pdf', async (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=medical_record_${req.user.id}.pdf`);
        
        await exportService.exportMedicalRecordPDF(req.user.id, res);
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF' });
        }
    }
});

module.exports = router;
