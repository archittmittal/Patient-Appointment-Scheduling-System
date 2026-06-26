/**
 * Shared K6 authentication helper.
 *
 * Usage in scenario scripts:
 *   import { login } from '../shared/auth.js';
 *   export function setup() { return login(); }
 *   export default function (data) {
 *     const token = data.token;
 *     ...
 *   }
 */

import http from 'k6/http';
import { check, fail } from 'k6';

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:7860';
const TEST_EMAIL = __ENV.TEST_EMAIL || 'patient@test.com';
const TEST_PASS  = __ENV.TEST_PASSWORD || 'Test@1234';

/**
 * Logs in with the configured test credentials and returns
 * { token, doctorId, patientId } for use by VUs.
 */
export function login() {
    const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS }),
        { headers: { 'Content-Type': 'application/json' } }
    );

    const ok = check(res, {
        '[setup] login status 200': (r) => r.status === 200,
        '[setup] token present':    (r) => {
            try {
                const body = JSON.parse(r.body);
                return !!(body.token || body.accessToken);
            } catch { return false; }
        },
    });

    if (!ok) {
        fail(`[auth/login] failed — status ${res.status}: ${res.body}`);
    }

    const body = JSON.parse(res.body);
    const token = body.token || body.accessToken;

    // Dynamically retrieve the first doctor ID if not specified or if default doctor 1 doesn't exist
    let doctorId = Number(__ENV.TEST_DOCTOR_ID);
    if (doctorId === 1 || !doctorId) {
        const docRes = http.get(`${BASE_URL}/api/doctors`);
        console.log(`[k6-auth-setup] docRes status: ${docRes.status}, body: ${docRes.body}`);
        if (docRes.status === 200) {
            try {
                const docs = JSON.parse(docRes.body);
                if (docs && docs.length > 0) {
                    const exists = docs.some(d => d.id === 1);
                    if (!exists) {
                        doctorId = docs[0].id;
                    }
                }
            } catch (e) {
                // Ignore parse error, fallback to 1
            }
        }
    }
    if (!doctorId) {
        doctorId = 1;
    }

    const patientId = body.id || body.user?.id || null;
    if (patientId) {
        // Try booking an appointment for today to ensure we have a live queue entry
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        const nextHour = (now.getHours() + 1) % 24;
        const slots = [
            `${String(nextHour).padStart(2, '0')}:00 – ${String((nextHour + 1) % 24).padStart(2, '0')}:00`
        ];
        for (const slot of slots) {
            const bookRes = http.post(
                `${BASE_URL}/api/appointments/book`,
                JSON.stringify({
                    doctorId,
                    date: todayStr,
                    timeSlot: slot,
                    symptoms: 'setup today queue entry',
                }),
                authHeaders(token)
            );
            if (bookRes.status === 201) {
                console.log(`[k6-auth-setup] Successfully booked today slot: ${slot} to populate live_queue`);
                break;
            } else {
                console.log(`[k6-auth-setup] Booking today slot ${slot} returned status: ${bookRes.status}`);
            }
        }
    }

    return {
        token,
        doctorId,
        patientId,
    };
}

/**
 * Returns standard auth headers for authenticated K6 requests.
 */
export function authHeaders(token) {
    return {
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
        },
    };
}

export { BASE_URL };
