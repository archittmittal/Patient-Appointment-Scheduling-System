/**
 * @file auth.js
 * @description Centralized authentication configuration.
 *
 * All values are read from environment variables so that no credentials are
 * ever hard-coded. The module performs a fail-fast check at require-time: if
 * JWT_SECRET is absent or falls below the minimum strength threshold the process
 * exits immediately rather than silently using an insecure token.
 */

const MIN_JWT_SECRET_LENGTH = 32;

const KNOWN_WEAK_SECRETS = [
    'hs_jwt_super_secret_change_in_production_2024',
    'your_super_secret_jwt_key_here',
    'replace_with_minimum_32_char_random_secret',
    'secret',
    'changeme',
];

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    console.error(
        '\x1b[31mFATAL: JWT_SECRET environment variable is not defined. ' +
        'Authentication cannot initialize.\x1b[0m'
    );
    process.exit(1);
}

if (KNOWN_WEAK_SECRETS.includes(jwtSecret) || jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    const isProd = process.env.NODE_ENV === 'production';
    const message =
        `JWT_SECRET is a known placeholder or shorter than ${MIN_JWT_SECRET_LENGTH} characters. ` +
        'Generate a secure value with: openssl rand -hex 32';

    if (isProd) {
        console.error(`\x1b[31mFATAL SECURITY: ${message}\x1b[0m`);
        process.exit(1);
    } else {
        // Warn but allow development to continue
        console.warn(`\x1b[33m⚠  SECURITY WARNING: ${message}\x1b[0m`);
    }
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
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',

    /**
     * bcrypt work factor (cost). Higher = slower hashing but more secure.
     * Recommended range: 10–12. Default: 10.
     */
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
};

module.exports = authConfig;
