/**
 * Global Error Handling Middleware
 */

/**
 * SEC-010/SEC-011: Safe error message helper.
 *
 * Returns `error.message` only in development mode or when the error is
 * explicitly marked as safe to surface to clients (error.isPublic === true).
 * In production, all other errors return a generic string to prevent leaking
 * SQL schema details, internal service errors, or library stack traces.
 *
 * @param {Error} error
 * @param {string} [fallback='An unexpected error occurred']
 * @returns {string}
 */
function safeErrorMessage(error, fallback = 'An unexpected error occurred') {
    if (process.env.NODE_ENV !== 'production') return error.message || fallback;
    if (error.isPublic) return error.message || fallback;
    return fallback;
}

function errorHandler(err, req, res, next) {
    const status = err.status || 'error';
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';

    // SEC-011: Never leak raw error.message in production from global handler
    const message = safeErrorMessage(err, 'An unexpected error occurred');

    console.error(`[${code}] ${err.message}`); // Full message always goes to server logs
    if (err.stack && process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    res.status(statusCode).json({
        status,
        statusCode,
        code,
        message,
        timestamp: new Date().toISOString(),
        // Include stack in development for easier debugging
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

module.exports = errorHandler;
module.exports.safeErrorMessage = safeErrorMessage;
