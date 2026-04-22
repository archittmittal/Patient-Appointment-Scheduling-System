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
        console.error('\x1b[31m%s\x1b[0m', 'ERROR: Missing required environment variables:');
        missing.forEach(m => console.error('\x1b[31m%s\x1b[0m', `  - ${m}`));
        console.error('\x1b[33m%s\x1b[0m', 'Please check your .env file or environment configuration.');
        
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        } else {
            console.warn('\x1b[33m%s\x1b[0m', 'Warning: Continuing in development mode, but some features may fail.');
        }
    } else {
        console.log('\x1b[32m%s\x1b[0m', '✓ Environment variables validated.');
    }
}

module.exports = validateEnv;
