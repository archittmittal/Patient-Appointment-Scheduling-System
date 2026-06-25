/**
 * Scenario 01 — Auth Login Stress Test
 *
 * Simulates a surge of concurrent logins (e.g. first-thing-in-morning OPD rush).
 * Validates that rate-limiting, JWT issuance, and DB lookup all hold under load.
 *
 * Targets: POST /api/auth/login
 *
 * Thresholds:
 *   - 95th-percentile response time < 500 ms
 *   - Error rate < 1%
 *   - 100% of checks pass
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import { BASE_URL } from '../shared/auth.js';

// Treat 2xx and 429 (rate-limited) as expected responses.
// Without this, the built-in http_req_failed metric counts every 429 as a
// failure, causing the http_req_failed threshold to trip even though rate
// limiting is intentional behaviour in this scenario.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 429));

// Custom metrics
const loginDuration = new Trend('login_req_duration', true);
const loginErrors   = new Rate('login_errors');

export const options = {
    stages: [
        { duration: '15s', target: 10  }, // Warm-up: ramp to 10 VUs
        { duration: '30s', target: 50  }, // Peak: ramp to 50 VUs
        { duration: '15s', target: 0   }, // Ramp-down
    ],
    thresholds: {
        // Overall HTTP duration (K6 built-in)
        http_req_duration: ['p(95)<500'],
        // Our custom metric
        login_req_duration: ['p(95)<500'],
        // Overall failure rate
        http_req_failed:   ['rate<0.01'],
        login_errors:      ['rate<0.01'],
    },
};

const LOGIN_PAYLOAD = JSON.stringify({
    email:    __ENV.TEST_EMAIL    || 'patient@test.com',
    password: __ENV.TEST_PASSWORD || 'Test@1234',
});

const HEADERS = { headers: { 'Content-Type': 'application/json' } };

export default function () {
    const res = http.post(`${BASE_URL}/api/auth/login`, LOGIN_PAYLOAD, HEADERS);

    loginDuration.add(res.timings.duration);
    loginErrors.add(res.status >= 400 && res.status !== 429); // 429 = rate-limited, expected

    check(res, {
        'auth: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
        'auth: response < 500 ms':    (r) => r.timings.duration < 500,
        'auth: has JSON body':        (r) => {
            try { JSON.parse(r.body); return true; } catch { return false; }
        },
    });

    // Think time: real users take ~1–2 s between requests
    sleep(Math.random() * 1 + 0.5);
}
