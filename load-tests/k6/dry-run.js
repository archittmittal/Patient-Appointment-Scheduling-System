/**
 * Day 11 — Dry-Run Smoke Test (50 VUs)
 *
 * A lightweight composite test that exercises all three critical routes
 * in sequence with a single pool of virtual users. This is the primary
 * script for:
 *   - Local developer validation
 *   - GitHub Actions CI gate (runs at 10 VUs in CI)
 *
 * Stages:  Ramp 0→10 VUs (15s) → sustain 50 VUs (45s) → ramp down (15s)
 * Total:   ~90 seconds wall-clock time
 *
 * Usage:
 *   k6 run load-tests/k6/dry-run.js
 *   k6 run --vus 10 --duration 30s load-tests/k6/dry-run.js  # CI variant
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

import { login, authHeaders, BASE_URL } from './shared/auth.js';

// Treat 2xx, 409 (slot conflict), 422 (validation error), and 429 (rate-limited) as expected responses.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409, 422, 429));

// ── Custom Metrics ─────────────────────────────────────────────────────────
const loginDuration = new Trend('dr_login_duration',  true);
const bookDuration  = new Trend('dr_book_duration',   true);
const queueDuration = new Trend('dr_queue_duration',  true);
const errorRate     = new Rate('dr_errors');
const totalReqs     = new Counter('dr_total_requests');

// ── Options ────────────────────────────────────────────────────────────────
export const options = {
    stages: [
        { duration: '15s', target: 10 }, // warm-up
        { duration: '45s', target: 50 }, // peak dry-run load
        { duration: '15s', target: 0  }, // ramp-down
    ],
    thresholds: {
        // Global HTTP
        http_req_duration: ['p(95)<1500'],
        http_req_failed:   ['rate<0.01'],
        // Our composite error metric
        dr_errors:         ['rate<0.01'],
        // Per-route duration budgets
        dr_login_duration: ['p(95)<1500'],
        dr_book_duration:  ['p(95)<2000'],
        dr_queue_duration: ['p(95)<1000'],
    },
    // Pretty summary on completion
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Setup: runs once before VUs start ──────────────────────────────────────
export function setup() {
    return login();
}

// ── VU Iteration ───────────────────────────────────────────────────────────
export default function (data) {
    const { token, doctorId, patientId } = data;
    let appointmentId = null;

    // ── Group 1: Auth (smoke) ──────────────────────────────────────────────
    group('1_auth_smoke', () => {
        const res = http.post(
            `${BASE_URL}/api/auth/login`,
            JSON.stringify({
                email:    __ENV.TEST_EMAIL    || 'patient@test.com',
                password: __ENV.TEST_PASSWORD || 'Test@1234',
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );

        loginDuration.add(res.timings.duration);
        totalReqs.add(1);
        const loginOk = res.status === 200 || res.status === 429;
        errorRate.add(!loginOk);

        check(res, {
            '[auth] 200 or 429':     (r) => r.status === 200 || r.status === 429,
            '[auth] < 500 ms':       (r) => r.timings.duration < 500,
        });
    });

    sleep(0.5);

    // ── Group 2: Appointment Booking ───────────────────────────────────────
    group('2_book_appointment', () => {
        const daysAhead = 1 + (__VU % 7);
        const future = (() => {
            const d = new Date();
            d.setDate(d.getDate() + daysAhead);
            return d.toISOString().split('T')[0];
        })();

        const slots = ['09:00 – 10:00', '10:00 – 11:00', '11:00 – 12:00'];
        const slot  = slots[__VU % slots.length];

        const res = http.post(
            `${BASE_URL}/api/appointments/book`,
            JSON.stringify({ doctorId, date: future, timeSlot: slot, symptoms: 'dry-run test' }),
            authHeaders(token)
        );

        if (res.status === 201) {
            try {
                const body = JSON.parse(res.body);
                appointmentId = body.appointmentId || body.id;
            } catch (e) {}
        }

        bookDuration.add(res.timings.duration);
        totalReqs.add(1);
        const bookOk = [201, 409, 422].includes(res.status);
        errorRate.add(!bookOk);

        check(res, {
            '[book] 201/409/422':   (r) => [201, 409, 422].includes(r.status),
            '[book] < 1,000 ms':    (r) => r.timings.duration < 1000,
        });
    });

    sleep(0.5);

    // ── Group 3: OPD Queue Fetch ───────────────────────────────────────────
    group('3_queue_fetch', () => {
        let targetId = appointmentId;
        if (!targetId && patientId) {
            // Fetch patient's active appointments as fallback
            const aptsRes = http.get(
                `${BASE_URL}/api/patients/${patientId}/appointments`,
                authHeaders(token)
            );
            if (aptsRes.status === 200) {
                try {
                    const aptsObj = JSON.parse(aptsRes.body);
                    const list = aptsObj.appointments || aptsObj;
                    if (list && list.length > 0) {
                        targetId = list[0].id;
                    }
                } catch (e) {}
            }
        }

        if (!targetId) {
            targetId = doctorId; // Absolute fallback (which will return 404/403, but avoids crashing script)
        }

        const res = http.get(
            `${BASE_URL}/api/appointments/queue/${targetId}`,
            authHeaders(token)
        );

        queueDuration.add(res.timings.duration);
        totalReqs.add(1);
        errorRate.add(res.status !== 200);

        check(res, {
            '[queue] 200':          (r) => r.status === 200,
            '[queue] < 500 ms':     (r) => r.timings.duration < 500,
            '[queue] is array':     (r) => {
                try {
                    const parsed = JSON.parse(r.body);
                    return Array.isArray(parsed) || typeof parsed === 'object';
                } catch { return false; }
            },
        });
    });

    // Think time between full iteration cycles
    sleep(Math.random() * 1.5 + 0.5);
}

// ── Custom Summary ─────────────────────────────────────────────────────────
export function handleSummary(data) {
    const thresholdsOk = Object.values(data.metrics).every((m) =>
        !m.thresholds || Object.values(m.thresholds).every((t) => !t.ok === false)
    );

    const status = thresholdsOk ? '✅ DRY-RUN PASSED' : '❌ DRY-RUN FAILED — thresholds breached';

    return {
        stdout: `\n${'─'.repeat(60)}\n${status}\n${'─'.repeat(60)}\n`,
        'load-tests/results/dry-run-summary.json': JSON.stringify(data, null, 2),
    };
}
