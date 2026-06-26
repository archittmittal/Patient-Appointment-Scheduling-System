/**
 * Day 13: WhatsApp Notification Integration Tests
 *
 * Covers:
 *  - whatsappService phone normalisation and provider selection
 *  - transportService.sendWhatsApp delegation
 *  - notificationService.notifyAppointmentBooked (mocked transport + DB)
 *  - preference opt-out (whatsapp_enabled = false skips channel)
 */

'use strict';

const assert = require('assert');

const BACKEND = `${__dirname}/../src`;

function freshRequire(relPath) {
    const abs = require.resolve(`${BACKEND}/${relPath}`);
    delete require.cache[abs];
    return require(abs);
}

// ─── 1. whatsappService unit tests ───────────────────────────────────────────

describe('whatsappService', () => {
    let whatsappService;

    beforeEach(() => {
        // Clear all WhatsApp-related env vars so we always start in log mode
        delete process.env.WHATSAPP_META_TOKEN;
        delete process.env.WHATSAPP_PHONE_NUMBER_ID;
        delete process.env.TWILIO_ACCOUNT_SID;
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.TWILIO_WHATSAPP_FROM;

        whatsappService = freshRequire('services/whatsappService');
    });

    describe('_normalisePhone()', () => {
        it('passes through valid E.164 numbers unchanged', () => {
            assert.strictEqual(whatsappService._normalisePhone('+919876543210'), '+919876543210');
            assert.strictEqual(whatsappService._normalisePhone('+14155551234'), '+14155551234');
        });

        it('prefixes +91 for bare 10-digit Indian mobile numbers', () => {
            assert.strictEqual(whatsappService._normalisePhone('9876543210'), '+919876543210');
            assert.strictEqual(whatsappService._normalisePhone('6000000000'), '+916000000000');
        });

        it('returns null for invalid numbers', () => {
            assert.strictEqual(whatsappService._normalisePhone('12345'), null);
            assert.strictEqual(whatsappService._normalisePhone('not-a-phone'), null);
            assert.strictEqual(whatsappService._normalisePhone(''), null);
            assert.strictEqual(whatsappService._normalisePhone(null), null);
        });

        it('strips whitespace before normalising', () => {
            assert.strictEqual(whatsappService._normalisePhone('  +919876543210  '), '+919876543210');
        });
    });

    describe('getProvider()', () => {
        it('returns "log" when no provider env vars are set', () => {
            assert.strictEqual(whatsappService.getProvider(), 'log');
        });

        it('returns "meta" when Meta env vars are set', () => {
            process.env.WHATSAPP_META_TOKEN = 'test-token';
            process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
            const svc = freshRequire('services/whatsappService');
            assert.strictEqual(svc.getProvider(), 'meta');
        });

        it('returns "twilio" when Twilio (but not Meta) env vars are set', () => {
            process.env.TWILIO_ACCOUNT_SID = 'ACtest';
            process.env.TWILIO_AUTH_TOKEN = 'auth-token';
            process.env.TWILIO_WHATSAPP_FROM = '+14155551234';
            const svc = freshRequire('services/whatsappService');
            assert.strictEqual(svc.getProvider(), 'twilio');
        });
    });

    describe('sendMessage() in log mode', () => {
        let logCalls;
        let originalLog;

        beforeEach(() => {
            logCalls = [];
            originalLog = console.log;
            console.log = (...args) => logCalls.push(args);
        });

        afterEach(() => {
            console.log = originalLog;
        });

        it('returns success=true with provider="log" for a valid phone', async () => {
            const result = await whatsappService.sendMessage('+919876543210', 'Test message');
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.provider, 'log');
        });

        it('logs the phone number and body', async () => {
            await whatsappService.sendMessage('9876543210', 'Hello patient!');
            const logArg = logCalls.find(args => args[0] === '[WhatsApp LOG]');
            assert.ok(logArg, 'Expected [WhatsApp LOG] prefix');
            assert.strictEqual(logArg[1].to, '+919876543210');
            assert.strictEqual(logArg[1].body, 'Hello patient!');
        });

        it('returns success=false for a missing phone number', async () => {
            const result = await whatsappService.sendMessage(null, 'Test');
            assert.strictEqual(result.success, false);
        });

        it('returns success=false for an invalid phone number', async () => {
            const result = await whatsappService.sendMessage('not-a-number', 'Test');
            assert.strictEqual(result.success, false);
        });
    });
});

// ─── 2. transportService.sendWhatsApp delegation ─────────────────────────────

describe('transportService.sendWhatsApp', () => {
    afterEach(() => {
        jest.resetModules();
    });

    it('delegates to whatsappService and returns the success flag', async () => {
        jest.resetModules();
        jest.mock(`${BACKEND}/services/whatsappService`, () => ({
            sendMessage: jest.fn(async () => ({ success: true, provider: 'log' }))
        }));
        const transport = require(`${BACKEND}/services/transportService`);
        const result = await transport.sendWhatsApp('+919876543210', 'Test message');
        assert.strictEqual(result, true);
    });

    it('returns false when whatsappService reports failure', async () => {
        jest.resetModules();
        jest.mock(`${BACKEND}/services/whatsappService`, () => ({
            sendMessage: jest.fn(async () => ({ success: false, provider: 'log', reason: 'Invalid number' }))
        }));
        const transport = require(`${BACKEND}/services/transportService`);
        const result = await transport.sendWhatsApp('invalid', 'Test');
        assert.strictEqual(result, false);
    });
});

// ─── 3. notificationService WhatsApp integration ─────────────────────────────

describe('notificationService WhatsApp channel', () => {
    let whatsappCalls;

    /**
     * Configure stubs with jest.doMock (not hoisted, can close over runtime vars),
     * then load a fresh notificationService inside jest.isolateModules.
     */
    async function buildService({ whatsappEnabled = true, phone = '+919876543210' } = {}) {
        whatsappCalls = [];
        let service;

        jest.isolateModules(() => {
            jest.doMock(`${BACKEND}/config/db`, () => ({
                query: jest.fn(async (sql) => {
                    if (sql.includes('FROM users')) {
                        return [[{ email: 'patient@test.com', phone }]];
                    }
                    return [[]];
                })
            }));

            jest.doMock(`${BACKEND}/services/templateService`, () => ({
                getTemplate: jest.fn(async () => ({
                    title_template: 'Confirmed with {{doctor_name}}',
                    message_template: 'Appt with {{doctor_name}} on {{date}}',
                    push_title: 'Confirmed',
                    push_body: 'See you soon',
                    sms_template: 'SMS: {{doctor_name}} {{date}}',
                    whatsapp_template: '✅ {{doctor_name}} on {{date}} at {{time_slot}}'
                })),
                processTemplate: jest.fn((tpl, data) => {
                    if (!tpl) return '';
                    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] != null ? String(data[k]) : ''));
                })
            }));

            jest.doMock(`${BACKEND}/services/notificationHistoryService`, () => ({
                createRecord: jest.fn(async () => 999),
                updateStatus: jest.fn(async () => {}),
                finalizeSentAt: jest.fn(async () => {}),
                getHistory: jest.fn(async () => []),
                markAsRead: jest.fn(async () => ({ success: true })),
                getUnreadCount: jest.fn(async () => 0)
            }));

            jest.doMock(`${BACKEND}/services/preferenceService`, () => ({
                getUserPreferences: jest.fn(async () => ({
                    push_enabled: false,
                    sms_enabled: false,
                    email_enabled: false,
                    whatsapp_enabled: whatsappEnabled,
                    push_subscription: null,
                    quiet_hours_enabled: false,
                    queue_updates: true,
                    appointment_reminders: true,
                    delay_alerts: true,
                    waitlist_offers: true,
                    cancellation_confirm: true
                })),
                getPreferenceField: jest.fn((type) => {
                    const map = { APPOINTMENT_BOOKED: 'appointment_reminders', QUEUE_UPDATE: 'queue_updates' };
                    return map[type] || null;
                }),
                isInQuietHours: jest.fn(() => false),
                updatePreferences: jest.fn(async () => ({ success: true })),
                savePushSubscription: jest.fn(async () => ({ success: true }))
            }));

            jest.doMock(`${BACKEND}/services/transportService`, () => ({
                sendPush: jest.fn(async () => false),
                sendSMS: jest.fn(async () => false),
                sendEmail: jest.fn(async () => false),
                sendWhatsApp: jest.fn(async (p, msg) => {
                    whatsappCalls.push({ phone: p, msg });
                    return true;
                })
            }));

            jest.doMock(`${BACKEND}/services/whatsappService`, () => ({
                sendMessage: jest.fn(async () => ({ success: true, provider: 'log' })),
                _normalisePhone: (p) => p,
                getProvider: () => 'log'
            }));

            service = require(`${BACKEND}/services/notificationService`);
        });

        return service;
    }

    afterEach(() => {
        jest.resetModules();
    });

    it('sends WhatsApp when whatsapp_enabled is true', async () => {
        const service = await buildService({ whatsappEnabled: true, phone: '+919876543210' });
        const result = await service.notifyAppointmentBooked(1, 'Sharma', '2026-07-01', '10:00 AM');
        assert.strictEqual(result.whatsapp, true, 'WhatsApp channel should succeed');
        assert.strictEqual(whatsappCalls.length, 1, 'sendWhatsApp should be called once');
        assert.strictEqual(whatsappCalls[0].phone, '+919876543210');
    });

    it('skips WhatsApp when whatsapp_enabled is false', async () => {
        const service = await buildService({ whatsappEnabled: false, phone: '+919876543210' });
        const result = await service.notifyAppointmentBooked(1, 'Sharma', '2026-07-01', '10:00 AM');
        assert.strictEqual(result.whatsapp, false, 'WhatsApp channel should be skipped');
        assert.strictEqual(whatsappCalls.length, 0, 'sendWhatsApp should NOT be called');
    });

    it('skips WhatsApp when user has no phone number', async () => {
        const service = await buildService({ whatsappEnabled: true, phone: null });
        const result = await service.notifyAppointmentBooked(1, 'Sharma', '2026-07-01', '10:00 AM');
        assert.strictEqual(result.whatsapp, false, 'WhatsApp should be skipped without phone');
        assert.strictEqual(whatsappCalls.length, 0);
    });

    it('notifyAppointmentBooked returns success=true overall', async () => {
        const service = await buildService({ whatsappEnabled: true, phone: '+919876543210' });
        const result = await service.notifyAppointmentBooked(1, 'Dr. Patel', '2026-07-01', '09:00 AM');
        assert.strictEqual(result.success, true);
    });
});

