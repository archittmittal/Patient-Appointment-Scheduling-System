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
        
        process.exit(1);
    } else {
        // Novel: Verify JWT Secret Strength
        const jwtSecret = process.env.JWT_SECRET;
        const isDefaultSecret = jwtSecret === 'hs_jwt_super_secret_change_in_production_2024';
        
        if (isDefaultSecret || jwtSecret.length < 32) {
            if (process.env.NODE_ENV === 'production') {
                console.error('\x1b[31m%s\x1b[0m', 'FATAL SECURITY ERROR: JWT_SECRET is using the default placeholder value or is too weak in production.');
                console.error('\x1b[31m%s\x1b[0m', 'Startup blocked for safety. Please configure a secure, random string (min 32 characters).');
                process.exit(1);
            } else {
                console.warn('\x1b[33m%s\x1b[0m', '⚠️  SECURITY WARNING: JWT_SECRET is using a default value or is too weak.');
                console.warn('\x1b[33m%s\x1b[0m', '   For production, please use a secure, random string (min 32 characters).');
            }
        } else {
            console.log('\x1b[32m%s\x1b[0m', '✓ Security: JWT Secret strength verified.');
        }

        // Sprint 3: Verify Stripe webhook secret is configured in production
        if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_WEBHOOK_SECRET) {
            console.error('\x1b[31m%s\x1b[0m', 'FATAL SECURITY ERROR: STRIPE_WEBHOOK_SECRET is not configured in production.');
            console.error('\x1b[31m%s\x1b[0m', 'Unverified Stripe webhooks will be rejected. Configure the signing secret from your Stripe Dashboard.');
            process.exit(1);
        } else if (!process.env.STRIPE_WEBHOOK_SECRET) {
            console.warn('\x1b[33m%s\x1b[0m', '⚠️  SECURITY WARNING: STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification is disabled in development.');
        } else {
            console.log('\x1b[32m%s\x1b[0m', '✓ Security: Stripe webhook secret configured.');
        }

        console.log('\x1b[32m%s\x1b[0m', '✓ Environment variables validated.');
    }
}

module.exports = validateEnv;

