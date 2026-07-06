const morgan = require('morgan');
const logger = require('../config/logger');

// Define token for authenticated user ID & role
morgan.token('user-id', (req) => (req.user && req.user.id ? req.user.id : '-'));
morgan.token('user-role', (req) => (req.user && req.user.role ? req.user.role : '-'));

// List of sensitive payload fields to redact
const SENSITIVE_FIELDS = [
    'password',
    'confirmPassword',
    'otp',
    'otpCode',
    'token',
    'newPassword',
    'oldPassword',
    'creditCard',
    'cvv',
    'card_number',
    'symptoms',
    'diagnosis',
    'prescription',
    'medications',
    'instructions',
    'treatment',
    'medical_history',
    'notes'
];

// Helper to recursively redact sensitive fields in an object
function redactObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Support arrays
    if (Array.isArray(obj)) {
        return obj.map(item => redactObject(item));
    }

    const copy = {};
    for (const key of Object.keys(obj)) {
        if (SENSITIVE_FIELDS.includes(key)) {
            copy[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            copy[key] = redactObject(obj[key]);
        } else {
            copy[key] = obj[key];
        }
    }
    return copy;
}

// Token to log redacted request body
morgan.token('body', (req) => {
    if (!req.body || Object.keys(req.body).length === 0) return '';
    try {
        const redacted = redactObject(req.body);
        return JSON.stringify(redacted);
    } catch (e) {
        return '[ERROR_PARSING_BODY]';
    }
});

// Production: Log structured metadata using Winston JSON logger
const productionMiddleware = morgan((tokens, req, res) => {
    const status = parseInt(tokens.status(req, res));
    const responseTime = parseFloat(tokens['response-time'](req, res));
    
    const bodyStr = tokens.body(req, res);
    let body = null;
    if (bodyStr && bodyStr !== '[ERROR_PARSING_BODY]') {
        try {
            body = JSON.parse(bodyStr);
        } catch (e) {}
    }

    const logMetadata = {
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: isNaN(status) ? null : status,
        responseTimeMs: isNaN(responseTime) ? null : responseTime,
        contentLength: tokens.res(req, res, 'content-length') || null,
        userId: tokens['user-id'](req, res),
        userRole: tokens['user-role'](req, res)
    };

    if (body) {
        logMetadata.body = body;
    }

    logger.http(`HTTP ${logMetadata.method} ${logMetadata.url} - ${logMetadata.status || '-'} (${logMetadata.responseTimeMs || '-'} ms)`, logMetadata);
    return null; // Return null so Morgan doesn't print to stdout itself
});

// Development: Log pretty colorized text string
const devFormat = ':method :url :status :res[content-length] - :response-time ms - user: :user-id (:user-role) :body';
const developmentMiddleware = morgan(devFormat, {
    stream: {
        write: (message) => {
            logger.http(message.trim());
        }
    }
});

const requestLogger = process.env.NODE_ENV === 'production' ? productionMiddleware : developmentMiddleware;

module.exports = requestLogger;
module.exports.redactObject = redactObject; // exported for testing
