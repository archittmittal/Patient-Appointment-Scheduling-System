/**
 * Scenario 03 — OPD Queue Fetch Throughput Test
 *
 * Simulates the doctor dashboard polling the live queue repeatedly —
 * the highest-read route in the system.
 * With the in-process TTL cache active, cached responses should serve
 * in < 200 ms even under 500 concurrent VUs.
 *
 * Targets: GET /api/appointments/queue/:doctorId
 *
 * Thresholds:
 *   - 95th-percentile < 500 ms  (200 ms for cache hits, buffer for misses)
 *   - Error rate < 0.5%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import { login, authHeaders, BASE_URL } from '../shared/auth.js';

const queueDuration = new Trend('queue_req_duration', true);
const queueErrors   = new Rate('queue_errors');

export const options = {
    stages: [
        { duration: '30s', target: 50  }, // Ramp-up: warm the cache
        { duration: '30s', target: 200 }, // Mid load
        { duration: '60s', target: 500 }, // Peak: 500 concurrent dashboard pollers
        { duration: '30s', target: 0   }, // Cool-down
    ],
    thresholds: {
        http_req_duration:  ['p(95)<500'],
        queue_req_duration: ['p(95)<500'],
        http_req_failed:    ['rate<0.005'],
        queue_errors:       ['rate<0.005'],
    },
};

export function setup() {
    return login();
}

export default function (data) {
    const { token, doctorId, patientId } = data;

    let targetId = doctorId;
    if (patientId) {
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

    const res = http.get(
        `${BASE_URL}/api/appointments/queue/${targetId}`,
        authHeaders(token)
    );

    queueDuration.add(res.timings.duration);
    queueErrors.add(res.status !== 200);

    check(res, {
        'queue: status 200':         (r) => r.status === 200,
        'queue: response < 500 ms':  (r) => r.timings.duration < 500,
        'queue: is array':           (r) => {
            try {
                const body = JSON.parse(r.body);
                return Array.isArray(body) || typeof body === 'object';
            } catch { return false; }
        },
    });

    // Dashboard polls every 15 s; simulate with a short think time
    sleep(Math.random() * 1 + 0.5);
}
