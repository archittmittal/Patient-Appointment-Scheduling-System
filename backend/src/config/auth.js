/**
 * Centralized Authentication Configuration
 */

const authConfig = {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
};

// Fail-safe for missing secret
if (!authConfig.jwtSecret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined. Authentication cannot initialize.');
}

module.exports = authConfig;
