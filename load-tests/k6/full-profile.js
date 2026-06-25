/**
 * Full 1,000-VU Stress Profile
 *
 * ⚠️  WARNING: Run this ONLY against a staging environment.
 *     Never run against production or a developer laptop.
 *
 * Simulates a full OPD rush across all three critical routes using
 * K6 scenarios (concurrent, independent VU pools per route).
 *
 * Usage:
 *   BASE_URL=https://staging.example.com k6 run load-tests/k6/full-profile.js
 *
 * Expected wall-clock time: ~8 minutes
 */

import { login, authHeaders, BASE_URL } from './shared/auth.js';
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ── Custom Metrics ─────────────────────────────────────────────────────────
const loginDuration = new Trend('fp_login_duration',  true);
const bookDuration  = new Trend('fp_book_duration',   true);
const queueDuration = new Trend('fp_queue_duration',  true);
const errorRate     = new Rate('fp_errors');

// ── Options — Named Scenarios ──────────────────────────────────────────────
export const options = {
    scenarios: {
        auth_storm: {
            executor:     'ramping-vus',
            startVUs:     0,
            stages: [
                { duration: '1m',  target: 200  },
                { duration: '2m',  target: 200  },
                { duration: '30s', target: 0    },
            ],
            exec: 'authScenario',
            gracefulRampDown: '30s',
        },
        booking_rush: {
            executor:     'ramping-vus',
            startVUs:     0,
            startTime:    '30s', // stagger start
            stages: [
                { duration: '1m',  target: 400  },
                { duration: '3m',  target: 400  },
                { duration: '30s', target: 0    },
            ],
            exec: 'bookScenario',
            gracefulRampDown: '30s',
        },
        queue_flood: {
            executor:     'ramping-vus',
            startVUs:     0,
            startTime:    '1m', // stagger start
            stages: [
                { duration: '1m',  target: 400  },
                { duration: '4m',  target: 400  },
                { duration: '30s', target: 0    },
            ],
            exec: 'queueScenario',
            gracefulRampDown: '30s',
        },
    },
    thresholds: {
        http_req_duration:  ['p(95)<1000', 'p(99)<2000'],
        http_req_failed:    ['rate<0.01'],
        fp_errors:          ['rate<0.01'],
        fp_login_duration:  ['p(95)<500'],
        fp_book_duration:   ['p(95)<1000'],
        fp_queue_duration:  ['p(95)<500'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Shared Setup ───────────────────────────────────────────────────────────
export function setup() {
    return login();
}

// ── Auth Scenario ──────────────────────────────────────────────────────────
export function authScenario() {
    const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({
            email:    __ENV.TEST_EMAIL    || 'patient@test.com',
            password: __ENV.TEST_PASSWORD || 'Test@1234',
        }),
        { headers: { 'Content-Type': 'application/json' } }
    );

    loginDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200 && res.status !== 429);

    check(res, {
        '[auth] 200 or 429': (r) => r.status === 200 || r.status === 429,
        '[auth] < 500 ms':   (r) => r.timings.duration < 500,
    });

    sleep(Math.random() * 2 + 1);
}

// ── Booking Scenario ───────────────────────────────────────────────────────
export function bookScenario(data) {
    const { token, doctorId } = data;

    const daysAhead = 1 + (__VU % 14);
    const future = (() => {
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        return d.toISOString().split('T')[0];
    })();

    const slots = ['09:00 – 10:00', '10:00 – 11:00', '11:00 – 12:00', '14:00 – 15:00', '15:00 – 16:00'];

    const res = http.post(
        `${BASE_URL}/api/appointments/book`,
        JSON.stringify({
            doctorId,
            date:     future,
            timeSlot: slots[__VU % slots.length],
            symptoms: 'Full load test',
        }),
        authHeaders(token)
    );

    bookDuration.add(res.timings.duration);
    errorRate.add(![201, 409, 422].includes(res.status));

    check(res, {
        '[book] 201/409/422':  (r) => [201, 409, 422].includes(r.status),
        '[book] < 1,000 ms':   (r) => r.timings.duration < 1000,
    });

    sleep(Math.random() * 3 + 1);
}

// ── Queue Fetch Scenario ───────────────────────────────────────────────────
export function queueScenario(data) {
    const { token, doctorId } = data;

    const res = http.get(
        `${BASE_URL}/api/appointments/queue/${doctorId}`,
        authHeaders(token)
    );

    queueDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
        '[queue] 200':       (r) => r.status === 200,
        '[queue] < 500 ms':  (r) => r.timings.duration < 500,
    });

    sleep(Math.random() * 1 + 0.5);
}

// ── Summary ────────────────────────────────────────────────────────────────
export function handleSummary(data) {
    return {
        'load-tests/results/full-profile-summary.json': JSON.stringify(data, null, 2),
        stdout: '\n[full-profile] Results written to load-tests/results/full-profile-summary.json\n',
    };
}
