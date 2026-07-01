const db = require('../config/db');
const logger = require('../config/logger');

async function verifyConsent(req, res, next) {
    const patientId = req.params.id;
    const doctorId = req.user.id;

    // Patients can access their own data, Admins can access everything
    if (req.user.role === 'ADMIN' || (req.user.role === 'PATIENT' && req.user.id == patientId)) {
        return next();
    }

    if (req.user.role === 'DOCTOR') {
        try {
            const [rows] = await db.query(
                `SELECT status FROM consent_logs 
                 WHERE patient_id = ? AND doctor_id = ? 
                 ORDER BY created_at DESC LIMIT 1`,
                [patientId, doctorId]
            );

            if (rows.length > 0 && rows[0].status === 'GRANTED') {
                return next();
            }

            return res.status(403).json({ 
                status: 'fail',
                message: 'Access denied: Patient consent is required to access these medical records.',
                code: 'CONSENT_REQUIRED'
            });
        } catch (error) {
            logger.error('[Verify Consent Error]', error);
            return res.status(500).json({ message: 'Server error verifying consent' });
        }
    }

    return res.status(403).json({ message: 'Access denied' });
}

module.exports = verifyConsent;
