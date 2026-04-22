/**
 * Handles actual sending of notifications through various channels
 */

// Web Push
let webpush;
try {
    webpush = require('web-push');
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
            'mailto:notifications@healthsync.com',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
    }
} catch (e) {
    // console.log('Web Push not configured');
}

// Twilio
let twilioClient;
try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
} catch (e) {
    // console.log('Twilio not configured');
}

const transportService = {
    /**
     * Send push notification
     */
    async sendPush(subscription, title, body, data = {}) {
        if (!webpush || !subscription) {
            console.log('[Push Notification LOG]', { title, body, data });
            return false;
        }
        
        try {
            const payload = JSON.stringify({
                title,
                body,
                icon: '/icons/notification-icon.png',
                badge: '/icons/badge-icon.png',
                data,
                actions: data.actions || []
            });
            
            await webpush.sendNotification(
                typeof subscription === 'string' ? JSON.parse(subscription) : subscription,
                payload
            );
            return true;
        } catch (error) {
            console.error('Push notification error:', error);
            return false;
        }
    },

    /**
     * Send SMS notification
     */
    async sendSMS(phoneNumber, message) {
        if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
            console.log('[SMS Notification LOG]', { to: phoneNumber, message });
            return false;
        }
        
        try {
            await twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });
            return true;
        } catch (error) {
            console.error('SMS notification error:', error);
            return false;
        }
    },

    /**
     * Send email notification
     */
    async sendEmail(email, subject, htmlBody) {
        // Placeholder for nodemailer/SendGrid integration
        console.log('[Email Notification LOG]', { to: email, subject, body: htmlBody.substring(0, 100) + '...' });
        return false;
    }
};

module.exports = transportService;
