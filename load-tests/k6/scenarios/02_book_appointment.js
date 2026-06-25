/**
 * Scenario 02 — Appointment Booking Concurrency Test
 *
 * Simulates multiple patients booking appointments simultaneously —
 * the classic OPD rush when the clinic opens.
 * Exercises the full booking transaction path including:
 *   - Authentication  (setup phase)
 *   - POST /api/appointments/book
 *   - Idempotency: 409 Conflict (slot full) is a valid, expected response
 *
 * Thresholds:
 *   - 95th-percentile < 1,000 ms
 *   - Error rate (non-200/409 responses) < 2%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import { login, authHeaders, BASE_URL } from '../shared/auth.js';

const bookDuration = new Trend('book_req_duration', true);
const bookErrors   = new Rate('book_errors');

export const options = {
    stages: [
        { duration: '20s', target: 20  }, // Ramp up
        { duration: '60s', target: 200 }, // Peak load
        { duration: '20s', target: 0   }, // Cool-down
    ],
    thresholds: {
        http_req_duration:  ['p(95)<1000'],
        book_req_duration:  ['p(95)<1000'],
        http_req_failed:    ['rate<0.02'],
        book_errors:        ['rate<0.02'],
    },
};

/** Run once before VUs start; returns shared data passed to each VU. */
export function setup() {
    return login();
}

/**
 * Generate a future date string (YYYY-MM-DD) offset by `daysAhead` days.
 * Each VU uses __VU to pick a slightly different date to avoid all collisions.
 */
function futureDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
}

/** Pick a time slot from the doctor's typical morning window. */
const TIME_SLOTS = [
    '09:00 – 10:00',
    '10:00 – 11:00',
    '11:00 – 12:00',
    '14:00 – 15:00',
    '15:00 – 16:00',
];

export default function (data) {
    const { token, doctorId } = data;

    // Each VU books a slightly different day to reduce artificial 409s in dry-run
    const daysAhead = 1 + (__VU % 10);
    const timeSlot  = TIME_SLOTS[__VU % TIME_SLOTS.length];

    const payload = JSON.stringify({
        doctorId,
        date:     futureDate(daysAhead),
        timeSlot,
        symptoms: 'Load test booking — automated',
    });

    const res = http.post(
        `${BASE_URL}/api/appointments/book`,
        payload,
        authHeaders(token)
    );

    bookDuration.add(res.timings.duration);
    // 201 = booked, 409 = slot full (valid), 422 = validation error (acceptable)
    const isExpected = [201, 409, 422].includes(res.status);
    bookErrors.add(!isExpected);

    check(res, {
        'book: status 201/409/422':   (r) => [201, 409, 422].includes(r.status),
        'book: response < 1,000 ms':  (r) => r.timings.duration < 1000,
        'book: has JSON body':        (r) => {
            try { JSON.parse(r.body); return true; } catch { return false; }
        },
    });

    // Think time simulates user filling out a form
    sleep(Math.random() * 2 + 1);
}
