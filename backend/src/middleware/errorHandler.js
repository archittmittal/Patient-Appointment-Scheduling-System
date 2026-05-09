/**
 * Global Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
    const status = err.status || 'error';
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message = err.message || 'An unexpected error occurred';

    console.error(`[${code}] ${message}`);
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
