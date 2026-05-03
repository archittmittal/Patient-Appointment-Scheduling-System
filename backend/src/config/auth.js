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
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET must be set in production environment.');
    }
    // In development, we can provide a persistent warning but allow local dev
    // However, it's safer to just require it from .env as per validateEnv.
}

module.exports = authConfig;
