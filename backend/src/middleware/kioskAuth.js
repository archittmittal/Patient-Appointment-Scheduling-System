/**
 * [SEC-012] Kiosk API Key Authentication Middleware
 *
 * The /scan endpoint is called by physical kiosk terminals (not authenticated
 * users), so it uses a pre-shared API key instead of JWT. The key is loaded
 * from the KIOSK_API_KEY environment variable.
 *
 * Usage:
 *   router.post('/scan', kioskAuth, handler)
 */

function kioskAuth(req, res, next) {
    const apiKey = req.headers['x-kiosk-api-key'];
    const expectedKey = process.env.KIOSK_API_KEY;

    if (!expectedKey) {
        if (process.env.NODE_ENV === 'production') {
            console.error('⛔ KIOSK_API_KEY is not configured. Rejecting unauthenticated kiosk request in production.');
            return res.status(500).json({ error: 'Kiosk authentication is not configured' });
        }
        // In development, warn but allow through
        console.warn('⚠️ KIOSK_API_KEY not set — allowing unauthenticated kiosk request in development mode.');
        return next();
    }

    if (!apiKey) {
        return res.status(401).json({ error: 'Missing X-Kiosk-API-Key header' });
    }

    // Constant-time comparison to prevent timing attacks
    const { timingSafeEqual } = require('crypto');
    const a = Buffer.from(apiKey);
    const b = Buffer.from(expectedKey);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Invalid kiosk API key' });
    }

    next();
}

module.exports = { kioskAuth };
