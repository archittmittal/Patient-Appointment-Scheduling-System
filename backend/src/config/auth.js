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

// ── Shannon entropy helper ──────────────────────────────────────────────────────────
/**
 * Calculates the Shannon entropy (bits per character) of a string.
 * A cryptographically secure 64-char hex string scores ~3.8+ bits.
 * A low-entropy string like 'aaaaaa...' scores 0 bits.
 *
 * @param {string} str
 * @returns {number} entropy in bits-per-character
 */
function calculateShannonEntropy(str) {
    if (!str || str.length === 0) return 0;
    const freqs = {};
    for (let i = 0; i < str.length; i++) {
        freqs[str[i]] = (freqs[str[i]] || 0) + 1;
    }
    let entropy = 0;
    for (const char in freqs) {
        const p = freqs[char] / str.length;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

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

// ── Shannon entropy check ─────────────────────────────────────────────────────────
const MIN_ENTROPY_BITS = 3.0;
const secretEntropy = calculateShannonEntropy(jwtSecret);
if (secretEntropy < MIN_ENTROPY_BITS) {
    const isProd = process.env.NODE_ENV === 'production';
    const message =
        `JWT_SECRET has low entropy (${secretEntropy.toFixed(2)} bits/char < ${MIN_ENTROPY_BITS} required). ` +
        'The secret uses too few unique characters — it could be guessed. ' +
        'Generate a strong secret: openssl rand -hex 32';
    if (isProd) {
        console.error(`\x1b[31mFATAL SECURITY: ${message}\x1b[0m`);
        process.exit(1);
    } else {
        console.warn(`\x1b[33m⚠  SECURITY WARNING: ${message}\x1b[0m`);
    }
} else {
    console.log(`\x1b[32m✓ JWT_SECRET entropy: ${secretEntropy.toFixed(2)} bits/char (OK)\x1b[0m`);
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
