/**
 * Validates required environment variables on startup
 */

const requiredEnvVars = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET'
];

function validateEnv() {
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
        console.error('\x1b[31m%s\x1b[0m', 'CRITICAL ERROR: Missing required environment variables:');
        missing.forEach(m => console.error('\x1b[31m%s\x1b[0m', `  - ${m}`));
        console.error('\x1b[33m%s\x1b[0m', 'Please check your .env file or environment configuration.');
        
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        } else {
            console.warn('\x1b[33m%s\x1b[0m', 'Warning: Continuing in development mode, but some features may fail.');
        }
    } else {
        // Novel: Verify JWT Secret Strength
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret === 'hs_jwt_super_secret_change_in_production_2024' || jwtSecret.length < 32) {
            console.warn('\x1b[33m%s\x1b[0m', '⚠️  SECURITY WARNING: JWT_SECRET is using a default value or is too weak.');
            console.warn('\x1b[33m%s\x1b[0m', '   For production, please use a secure, random string (min 32 characters).');
        } else {
            console.log('\x1b[32m%s\x1b[0m', '✓ Security: JWT Secret strength verified.');
        }
        console.log('\x1b[32m%s\x1b[0m', '✓ Environment variables validated.');
    }
}

module.exports = validateEnv;

