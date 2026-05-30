const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

/**
 * Middleware: verify Bearer JWT token.

 * On success attaches req.user = { id, email, role }.
 */
function authenticate(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    return verifyToken(token, req, res, next);
}

function authenticateSse(req, res, next) {
    const token = extractBearerToken(req) || extractSseTokenFromUrl(req);
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    return verifyToken(token, req, res, next);
}

function extractBearerToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    function extractSseTokenFromUrl(req) {
        const requestUrl = req.originalUrl || req.url || '';
        const queryStart = requestUrl.indexOf('?');
        if (queryStart < 0) {
            return '';
        }

        const queryParams = new URLSearchParams(requestUrl.slice(queryStart + 1));
        const token = queryParams.get('token') || '';
        if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
            return '';
        }

        return token;
    }
    return '';
}

function verifyToken(token, req, res, next) {
    try {
        req.user = jwt.verify(token, jwtSecret);
        return next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

/**
 * Middleware factory: require a specific role.
 * Usage: requireRole('ADMIN')
 */
function requireRole(roles) {
    const authorizedRoles = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        if (!req.user || !authorizedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { authenticate, authenticateSse, requireRole, jwtSecret };
