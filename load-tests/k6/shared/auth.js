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

    return {
        token,
        doctorId:  Number(__ENV.TEST_DOCTOR_ID)  || 1,
        patientId: body.user?.id || null,
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
