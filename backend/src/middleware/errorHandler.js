/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${err.message}`);
    if (err.stack) console.error(err.stack);

    // Joi Validation Errors
    if (err.isJoi) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation Failed',
            details: err.details.map(d => d.message)
        });
    }

    // JWT Errors
    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid or expired token'
        });
    }

    // Default Server Error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : message
    });
};

module.exports = errorHandler;
