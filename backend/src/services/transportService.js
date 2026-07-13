/**
 * Handles actual sending of notifications through various channels
 */

const whatsappService = require('./whatsappService');
const emailService = require('./emailService');
const logger = require('../config/logger');

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

class TransportService {
    constructor() {
        // Ensure methods are bound to this instance
        this.sendPush = this.sendPush.bind(this);
        this.sendSMS = this.sendSMS.bind(this);
        this.sendEmail = this.sendEmail.bind(this);
        this.sendWhatsApp = this.sendWhatsApp.bind(this);
    }

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
            logger.error('Push notification error:', error);
            return false;
        }
    }

    /**
     * Send SMS notification
     */
    async sendSMS(phoneNumber, message) {
        if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
            logger.info('[SMS Notification LOG]', { to: phoneNumber, message });
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
            logger.error('SMS notification error:', error);
            return false;
        }
    }

    /**
     * Send email notification
     */
    async sendEmail(email, subject, htmlBody) {
        try {
            await emailService.sendEmail(email, subject, htmlBody);
            logger.info('Email notification sent successfully', { to: email, subject });
            return true;
        } catch (error) {
            logger.error('Email notification error:', error);
            return false;
        }
    }

    /**
     * Send WhatsApp notification
     * Delegates to whatsappService which handles provider selection and fallbacks.
     *
     * @param {string} phoneNumber  E.164 or bare 10-digit Indian number
     * @param {string} message      Message body
     * @returns {Promise<boolean>}
     */
    async sendWhatsApp(phoneNumber, message) {
        const result = await whatsappService.sendMessage(phoneNumber, message);
        return result.success;
    }
}

module.exports = new TransportService();
