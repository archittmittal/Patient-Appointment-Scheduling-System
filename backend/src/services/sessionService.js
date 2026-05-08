const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../middleware/authenticate');

class SessionService {
    /**
     * Generate a new JWT token for a user
     * @param {Object} user User object containing id, email, role
     * @param {string} expiresIn Token expiry time (default 8h)
     * @returns {string} JWT token
     */
    generateToken(user, expiresIn = '8h') {
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
            return jwt.verify(token, jwtSecret);
        } catch (error) {
            return null;
        }
    }
}

module.exports = new SessionService();
