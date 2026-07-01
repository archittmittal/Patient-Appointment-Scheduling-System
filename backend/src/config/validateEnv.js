/**
 * @file validateEnv.js
 * @description Validates all required and security-critical environment variables
 * at application startup. Prevents the server from starting in an unsafe or
 * misconfigured state.
 *
 * Severity levels:
 *  - FATAL  → logs error + exits with code 1 (both dev and prod)
 *  - WARN   → logs warning in dev; exits with code 1 in prod
 *  - INFO   → logs confirmation of correctly set values
 */

const logger = require('./logger');
const {
    calculateShannonEntropy,
    MIN_JWT_SECRET_LENGTH,
    MIN_ENTROPY_BITS,
    KNOWN_WEAK_SECRETS,
} = require('./crypto-utils');

/**
 * Vars that must be present for the server to function at all.
 * Missing any one of these = hard crash in ALL environments.
 */
const REQUIRED_VARS = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET',
];

/**
 * Vars that must be present in production specifically.
 * Missing = hard crash only in production.
 */
const PRODUCTION_REQUIRED_VARS = [
    'APP_URL',
    'FRONTEND_URL',
    'STRIPE_WEBHOOK_SECRET',
];

function validateEnv() {
    const isProd = process.env.NODE_ENV === 'production';
    let hasSecurityWarnings = false;

    // ── 1. Required vars (all environments) ────────────────────────────────────
    const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
    if (missing.length > 0) {
        logger.error('FATAL: Missing required environment variables — server cannot start:');
        missing.forEach((m) => logger.error(`  ✗  ${m}`));
        logger.warn('  → Copy backend/.env.example to backend/.env and fill in real values.');
        process.exit(1);
    }

    // ── 2. URL format validation ────────────────────────────────────────────────
    const urlVars = { APP_URL: process.env.APP_URL, FRONTEND_URL: process.env.FRONTEND_URL };
    for (const [key, value] of Object.entries(urlVars)) {
        if (value) {
            try {
                new URL(value);
            } catch {
                logger.error(`FATAL: ${key} contains an invalid URL: "${value}"`);
                process.exit(1);
            }
        }
    }

    // ── 3. Production-only required vars ───────────────────────────────────────
    if (isProd) {
        const missingProd = PRODUCTION_REQUIRED_VARS.filter((v) => !process.env[v]);
        if (missingProd.length > 0) {
            logger.error('FATAL: Missing required production environment variables:');
            missingProd.forEach((m) => logger.error(`  ✗  ${m}`));
            process.exit(1);
        }
    }

    // ── 4. JWT_SECRET strength ──────────────────────────────────────────────────
    const jwtSecret = process.env.JWT_SECRET;
    const isWeakSecret =
        KNOWN_WEAK_SECRETS.includes(jwtSecret) || jwtSecret.length < MIN_JWT_SECRET_LENGTH;

    if (isWeakSecret) {
        const msg = `JWT_SECRET is using a default/placeholder value or is too short (< ${MIN_JWT_SECRET_LENGTH} chars). Generate a strong secret with: openssl rand -hex 32`;
        if (isProd) {
            logger.error(`FATAL SECURITY: ${msg}`);
            process.exit(1);
        }
        logger.warn(`SECURITY WARNING: ${msg}`);
        hasSecurityWarnings = true;
    } else {
        // ── 4b. Shannon entropy check ──────────────────────────────────────────
        const secretEntropy = calculateShannonEntropy(jwtSecret);
        if (secretEntropy < MIN_ENTROPY_BITS) {
            const msg = `JWT_SECRET has low entropy (${secretEntropy.toFixed(2)} bits/char < ${MIN_ENTROPY_BITS} required). The secret uses too few unique characters — it could be guessed. Generate a strong secret with: openssl rand -hex 32`;
            if (isProd) {
                logger.error(`FATAL SECURITY: ${msg}`);
                process.exit(1);
            }
            logger.warn(`SECURITY WARNING: ${msg}`);
            hasSecurityWarnings = true;
        } else {
            logger.info(`JWT_SECRET strength: OK (entropy ${secretEntropy.toFixed(2)} bits/char)`);
        }
    }

    // ── 5. STRIPE_WEBHOOK_SECRET ────────────────────────────────────────────────
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        const msg = 'STRIPE_WEBHOOK_SECRET is not set — webhook signature verification is disabled.';
        if (isProd) {
            logger.error(`FATAL SECURITY: ${msg}`);
            process.exit(1);
        }
        logger.warn(`SECURITY WARNING: ${msg}`);
        hasSecurityWarnings = true;
    } else {
        logger.info('✓ STRIPE_WEBHOOK_SECRET: configured');
    }

    // ── 5b. FRONTEND_URL warning ────────────────────────────────────────────────
    if (!process.env.FRONTEND_URL) {
        const msg = 'FRONTEND_URL is not set — email action links will point to localhost!';
        if (isProd) {
            logger.error(`FATAL SECURITY: ${msg}`);
            process.exit(1);
        }
        logger.warn(`SECURITY WARNING: ${msg}`);
        hasSecurityWarnings = true;
    } else {
        logger.info('✓ FRONTEND_URL: configured');
    }

    // ── 6. BCRYPT_ROUNDS sanity (numeric + safe range) ─────────────────────────
    if (process.env.BCRYPT_ROUNDS !== undefined) {
        const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS, 10);
        if (isNaN(bcryptRounds)) {
            logger.error('FATAL: BCRYPT_ROUNDS must be a number (recommended: 10–12).');
            process.exit(1);
        }
        if (bcryptRounds < 10) {
            const msg = `BCRYPT_ROUNDS is set to ${bcryptRounds}, which is below the recommended minimum of 10.`;
            if (isProd) {
                logger.error(`FATAL SECURITY: ${msg}`);
                process.exit(1);
            }
            logger.warn(`SECURITY WARNING: ${msg}`);
            hasSecurityWarnings = true;
        } else if (bcryptRounds > 14) {
            logger.warn(`BCRYPT_ROUNDS=${bcryptRounds} is very high and will make login extremely slow. Recommended: 10–12.`);
        } else {
            logger.info(`✓ BCRYPT_ROUNDS: ${bcryptRounds}`);
        }
    }

    // ── 7. Numeric env-var sanity checks ───────────────────────────────────────
    const numericChecks = {
        DB_PORT: { min: 1, max: 65535 },
        RATE_LIMIT_WINDOW_MINS: { min: 1, max: 1440 },
        RATE_LIMIT_MAX: { min: 1, max: 10000 },
        SLOW_QUERY_THRESHOLD_MS: { min: 1, max: 30000 },
    };

    for (const [key, { min, max }] of Object.entries(numericChecks)) {
        const raw = process.env[key];
        if (raw !== undefined) {
            const parsed = parseInt(raw, 10);
            if (isNaN(parsed) || parsed < min || parsed > max) {
                logger.error(
                    `FATAL: ${key}="${raw}" is not a valid number (expected integer between ${min} and ${max}).`
                );
                process.exit(1);
            }
        }
    }

    // ── 8. NODE_ENV check ──────────────────────────────────────────────────────
    const validNodeEnvs = ['development', 'production', 'test'];
    if (process.env.NODE_ENV && !validNodeEnvs.includes(process.env.NODE_ENV)) {
        logger.warn(
            `NODE_ENV="${process.env.NODE_ENV}" is not a recognised value. Expected: development | production | test.`
        );
    }

    // ── Summary ─────────────────────────────────────────────────────────────────
    if (hasSecurityWarnings) {
        logger.warn('Environment validated with security warnings — do NOT deploy to production in this state.');
    } else {
        logger.info('All environment variables validated successfully.');
    }
}

module.exports = validateEnv;
