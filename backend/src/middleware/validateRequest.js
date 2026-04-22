/**
 * Validation Middleware factory
 * Usage: router.post('/path', validateRequest(schema), handler)
 */
function validateRequest(schema) {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            abortEarly: false,
            allowUnknown: true,
            stripUnknown: true
        });

        if (error) {
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            const err = new Error(errorMessage);
            err.statusCode = 400;
            return next(err);
        }

        next();
    };
}

module.exports = validateRequest;
