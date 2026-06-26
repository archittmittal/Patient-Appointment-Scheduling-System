/**
 * WhatsApp Notification Service
 *
 * Provider-abstracted WhatsApp messaging with automatic fallback:
 *   1. Meta WhatsApp Business Cloud API (primary)
 *   2. Twilio WhatsApp (fallback)
 *   3. Structured console.log in dev / when neither is configured
 *
 * Required env vars per provider:
 *   Meta:   WHATSAPP_META_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 *   Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 */

const https = require('https');

// ─── Provider detection ───────────────────────────────────────────────────────

function detectProvider() {
    if (process.env.WHATSAPP_META_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
        return 'meta';
    }
    if (
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM
    ) {
        return 'twilio';
    }
    return 'log'; // dev / CI fallback — always succeeds
}

// ─── Meta Cloud API sender ────────────────────────────────────────────────────

/**
 * Send a free-form text message via Meta WhatsApp Business Cloud API.
 * Uses the `messages` endpoint with type=text so no pre-approved template is needed
 * within the 24-hour customer service window.
 *
 * @param {string} to    E.164 phone number e.g. "+919876543210"
 * @param {string} body  Message text (up to 4096 chars)
 * @returns {Promise<boolean>}
 */
async function sendViaMeta(to, body) {
    const token = process.env.WHATSAPP_META_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    const payload = JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body }
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'graph.facebook.com',
            path: `/v19.0/${phoneNumberId}/messages`,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    console.error('[WhatsApp Meta] API error', res.statusCode, data);
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.error('[WhatsApp Meta] Request error:', err.message);
            resolve(false);
        });

        req.write(payload);
        req.end();
    });
}

// ─── Twilio WhatsApp sender ───────────────────────────────────────────────────

/**
 * Send a WhatsApp message via Twilio.
 *
 * @param {string} to    E.164 phone number
 * @param {string} body  Message text
 * @returns {Promise<boolean>}
 */
async function sendViaTwilio(to, body) {
    let twilioClient;
    try {
        const twilio = require('twilio');
        twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
    } catch (e) {
        console.error('[WhatsApp Twilio] twilio package not installed:', e.message);
        return false;
    }

    try {
        await twilioClient.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
            to: `whatsapp:${to}`,
            body
        });
        return true;
    } catch (err) {
        console.error('[WhatsApp Twilio] Send error:', err.message);
        return false;
    }
}

// ─── Service class ────────────────────────────────────────────────────────────

class WhatsAppService {
    /**
     * Send a WhatsApp message to a recipient.
     * Automatically selects the configured provider and falls back gracefully.
     *
     * @param {string} to    E.164 phone number e.g. "+919876543210"
     * @param {string} body  Plain-text message body
     * @returns {Promise<{success: boolean, provider: string}>}
     */
    async sendMessage(to, body) {
        if (!to) {
            return { success: false, provider: 'none', reason: 'No phone number provided' };
        }

        // Normalise to E.164 — add +91 prefix for bare 10-digit Indian numbers
        const normalisedTo = this._normalisePhone(to);
        if (!normalisedTo) {
            return { success: false, provider: 'none', reason: `Invalid phone number: ${to}` };
        }

        const provider = detectProvider();

        if (provider === 'meta') {
            const ok = await sendViaMeta(normalisedTo, body);
            return { success: ok, provider: 'meta' };
        }

        if (provider === 'twilio') {
            const ok = await sendViaTwilio(normalisedTo, body);
            return { success: ok, provider: 'twilio' };
        }

        // Dev / CI log-only mode
        console.log('[WhatsApp LOG]', {
            to: normalisedTo,
            body,
            timestamp: new Date().toISOString()
        });
        return { success: true, provider: 'log' };
    }

    /**
     * Normalise phone number to E.164.
     * - Already E.164 (+...): pass through
     * - Bare 10-digit Indian number: prefix +91
     * - Anything else: return null (invalid)
     *
     * @param {string} phone
     * @returns {string|null}
     */
    _normalisePhone(phone) {
        if (!phone) return null;
        const stripped = String(phone).replace(/\s+/g, '');

        // Already E.164
        if (/^\+\d{7,15}$/.test(stripped)) return stripped;

        // Bare 10-digit Indian mobile number
        if (/^[6-9]\d{9}$/.test(stripped)) return `+91${stripped}`;

        return null;
    }

    /** Expose provider detection for testing / diagnostics */
    getProvider() {
        return detectProvider();
    }
}

module.exports = new WhatsAppService();
