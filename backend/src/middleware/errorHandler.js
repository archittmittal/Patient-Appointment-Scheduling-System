/**
 * Global Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
    console.error(`[Error] ${err.message}`);
    if (err.stack) {
        // Only log stack trace in development
        if (process.env.NODE_ENV === 'development') {
            console.error(err.stack);
        }
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        status: 'error',
        statusCode,
        message,
        // Include stack in development for easier debugging
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
}

module.exports = errorHandler;
