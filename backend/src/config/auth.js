/**
 * @file auth.js
 * @description Centralized authentication configuration.
 *
 * All values are read from environment variables so that no credentials are
 * ever hard-coded. The module performs a fail-fast check at require-time: if
 * JWT_SECRET is absent or falls below the minimum strength threshold the process
 * exits immediately rather than silently using an insecure token.
 *
 * Strength thresholds enforced:
 *  1. Minimum length of 32 characters.
 *  2. Not a known placeholder/weak value.
 *  3. Shannon entropy >= 3.0 bits (prevents low-variety secrets like
 *     'aaaa...aaaa' or '1234567812345678...' that pass length checks).
 */

const logger = require('./logger');
const {
    calculateShannonEntropy,
    MIN_JWT_SECRET_LENGTH,
    MIN_ENTROPY_BITS,
    KNOWN_WEAK_SECRETS,
} = require('./crypto-utils');

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    logger.error(
        'FATAL: JWT_SECRET environment variable is not defined. ' +
        'Authentication cannot initialize.'
    );
    process.exit(1);
}

if (KNOWN_WEAK_SECRETS.includes(jwtSecret) || jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    const isProd = process.env.NODE_ENV === 'production';
    const message =
        `JWT_SECRET is a known placeholder or shorter than ${MIN_JWT_SECRET_LENGTH} characters. ` +
        'Generate a secure value with: openssl rand -hex 32';

    if (isProd) {
        logger.error(`FATAL SECURITY: ${message}`);
        process.exit(1);
    } else {
        // Warn but allow development to continue
        logger.warn(`SECURITY WARNING: ${message}`);
    }
}

// ── Shannon entropy check ─────────────────────────────────────────────────────────
const secretEntropy = calculateShannonEntropy(jwtSecret);
if (secretEntropy < MIN_ENTROPY_BITS) {
    const isProd = process.env.NODE_ENV === 'production';
    const message =
        `JWT_SECRET has low entropy (${secretEntropy.toFixed(2)} bits/char < ${MIN_ENTROPY_BITS} required). ` +
        'The secret uses too few unique characters — it could be guessed. ' +
        'Generate a strong secret: openssl rand -hex 32';
    if (isProd) {
        logger.error(`FATAL SECURITY: ${message}`);
        process.exit(1);
    } else {
        logger.warn(`SECURITY WARNING: ${message}`);
    }
} else {
    logger.info(`JWT_SECRET entropy: ${secretEntropy.toFixed(2)} bits/char (OK)`);
}


const authConfig = {
    /**
     * Secret used to sign and verify JSON Web Tokens.
     * Minimum 32 characters, cryptographically random.
     */
    jwtSecret,

    /**
     * Token lifetime — defaults to 8 hours if not overridden.
     * Accepts any value accepted by the `jsonwebtoken` `expiresIn` option
     * (e.g. "8h", "1d", "7d").
     */
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',

    /**
     * bcrypt work factor (cost). Higher = slower hashing but more secure.
     * Recommended range: 10–12. Default: 10.
     */
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
};

module.exports = authConfig;
