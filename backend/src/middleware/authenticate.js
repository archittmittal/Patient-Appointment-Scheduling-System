const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

/**
 * Extracts a JWT token from the Authorization: Bearer <token> header.
 * Returns null if the header is absent or malformed.
 *
 * [SEC-002] Only the Bearer header is accepted for standard auth.
 * URL query-param token support (?token=...) is intentionally NOT supported here
 * — that pattern leaks tokens into server logs, browser history, and referer headers.
 */
function extractBearerToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

/**
 * Extracts a JWT token from the `?token=` query parameter.
 * This is used EXCLUSIVELY by authenticateSse because the browser's native
 * EventSource API cannot set custom headers.
 *
 * Token must match a basic 3-segment JWT pattern to prevent log injection.
 */
function extractSseTokenFromUrl(req) {
    const requestUrl = req.originalUrl || req.url || '';
    const queryStart = requestUrl.indexOf('?');
    if (queryStart < 0) return null;

    const queryParams = new URLSearchParams(requestUrl.slice(queryStart + 1));
    const token = queryParams.get('token') || '';
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
        return null;
    }
    return token;
}

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

/**
 * SSE-specific auth middleware: accepts Bearer header OR ?token= query param.
 * The ?token= fallback is necessary because browsers cannot set headers on
 * EventSource connections.
 */
function authenticateSse(req, res, next) {
    const token = extractBearerToken(req) || extractSseTokenFromUrl(req);
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    return verifyToken(token, req, res, next);
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
