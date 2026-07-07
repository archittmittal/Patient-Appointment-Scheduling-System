/**
 * authorizeOwner.js — Middleware factory to authorize resource ownership.
 *
 * Allows 'ADMIN' role unconditionally.
 * Allows any roles listed in `options.allowRoles` (e.g. ['DOCTOR']).
 * Otherwise, requires `parseInt(req.user.id, 10) === parseInt(req.params[paramName], 10)`.
 *
 * @param {string} paramName - Name of the route parameter containing the owner's ID (e.g. 'id')
 * @param {object} [options] - Configuration options
 * @param {string[]} [options.allowRoles] - Additional user roles allowed to access the resource
 */
function authorizeOwner(paramName, options = {}) {
    const { allowRoles = [] } = options;
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Admins are always authorized
        if (req.user.role === 'ADMIN') {
            return next();
        }

        // Check if user has an explicitly allowed role
        if (allowRoles.includes(req.user.role)) {
            return next();
        }

        // Compare request user ID against route parameter value
        const ownerId = parseInt(req.params[paramName], 10);
        const requestUserId = parseInt(req.user.id, 10);

        if (!isNaN(ownerId) && requestUserId === ownerId) {
            return next();
        }

        return res.status(403).json({ message: 'Access denied' });
    };
}

module.exports = authorizeOwner;
