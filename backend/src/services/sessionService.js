const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
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

    /**
     * Generate a new Refresh Token
     * @param {number} userId User ID
     * @returns {Promise<string>} Refresh token string
     */
    async generateRefreshToken(userId) {
        const token = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // expires in 7 days
        
        const expiresAtMysql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, token, expiresAtMysql]
        );

        return token;
    }
}

module.exports = new SessionService();
