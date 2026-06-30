const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/auth');

class SessionService {
    /**
     * Generate a new JWT token for a user
     * @param {Object} user User object containing id, email, role
     * @param {string} expiresIn Token expiry time (default config-driven)
     * @returns {string} JWT token
     */
    generateToken(user, expiresIn = jwtExpiresIn) {
        return jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            jwtSecret,
            { expiresIn }
        );
    }

    /**
     * Verify a JWT token
     * @param {string} token JWT token to verify
     * @returns {Object} Decoded payload
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        } catch (error) {
            return null;
        }
    }
}

module.exports = new SessionService();
