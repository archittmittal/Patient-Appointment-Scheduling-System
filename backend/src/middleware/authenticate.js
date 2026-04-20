const jwt = require('jsonwebtoken');
const config = require('../config');

const JWT_SECRET = config.jwt.secret;



/**
 * Middleware: verify Bearer JWT token.
 * On success attaches req.user = { id, email, role }.
 */
function authenticate(req, res, next) {
    let token = '';
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

/**
 * Middleware factory: require a specific role.
 * Usage: requireRole('ADMIN')
 */
function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { authenticate, requireRole, JWT_SECRET };
