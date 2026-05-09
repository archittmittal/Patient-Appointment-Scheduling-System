/**
 * Validation Middleware factory
 * Usage: 
 *   router.post('/path', validateRequest(schema), handler) // validates body
 *   router.get('/path', validateRequest(schema, 'query'), handler) // validates query
 */
function validateRequest(schema, source = 'body') {
    return (req, res, next) => {
        const data = source === 'query' ? req.query : (source === 'params' ? req.params : req.body);
        
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            allowUnknown: true,
            stripUnknown: true
        });

        if (error) {
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            const err = new Error(errorMessage);
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            return next(err);
        }

        // Replace request data with validated/stripped values
        if (source === 'query') req.query = value;
        else if (source === 'params') req.params = value;
        else req.body = value;

        next();
    };
}

module.exports = validateRequest;
