const db = require('../config/db');
const logger = require('../config/logger');

function logPhiAccess(action, resource) {
    return async (req, res, next) => {
        try {
            const userId = req.user ? req.user.id : null;
            if (!userId) {
                return next();
            }

            const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];

            // Log PHI access asynchronously
            const queryPromise = db.query(
                `INSERT INTO audit_logs (user_id, action, resource_accessed, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, action, resource || req.originalUrl, ipAddress, userAgent]
            );
            if (queryPromise && typeof queryPromise.catch === 'function') {
                queryPromise.catch(err => {
                    logger.error('Failed to write PHI audit log:', err);
                });
            }

            next();
        } catch (error) {
            logger.error('Audit logger middleware error:', error);
            next();
        }
    };
}

module.exports = { logPhiAccess };
