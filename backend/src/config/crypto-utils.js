/**
 * @file crypto-utils.js
 * @description Shared cryptographic helper functions and security constants.
 */

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
const MIN_ENTROPY_BITS = 3.0;

const KNOWN_WEAK_SECRETS = [
    'hs_jwt_super_secret_change_in_production_2024',
    'your_super_secret_jwt_key_here',
    'replace_with_minimum_32_char_random_secret',
    'secret',
    'changeme',
];

module.exports = {
    calculateShannonEntropy,
    MIN_JWT_SECRET_LENGTH,
    MIN_ENTROPY_BITS,
    KNOWN_WEAK_SECRETS,
};
