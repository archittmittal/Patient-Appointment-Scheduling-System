/**
 * metricsService.js — Lightweight in-process request metrics store.
 *
 * Records response time samples per HTTP route in a capped rolling window and
 * computes latency percentiles (p50, p95, p99) on demand. No external
 * dependencies — works in both single-instance and multi-instance deployments
 * (with the understanding that multi-instance metrics are per-process).
 */

const WINDOW_SIZE = 1000; // max samples kept per route
const MAX_TRACKED_ROUTES = 100;
const OVERFLOW_ROUTE_KEY = 'OTHER';

// Internal state
const _samples = {}; // { "GET /api/appointments": [12, 45, ...] }
const _counts = {};  // { "GET /api/appointments": { total, errors4xx, errors5xx } }
const _startTime = Date.now();

/**
 * Normalise dynamic path segments so metrics group correctly.
 * e.g. /api/patients/42/appointments → /api/patients/:id/appointments
 *
 * @param {string} url  Raw req.url or req.originalUrl
 * @returns {string}    Normalised route string
 */
function normaliseRoute(url) {
    return url
        .split('?')[0]                                    // strip query string
        .replace(/\/\d+/g, '/:id')                        // numeric IDs
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid'); // UUIDs
}

/**
 * Record a completed HTTP request.
 *
 * @param {string} method       HTTP method (GET, POST, …)
 * @param {string} url          Raw request URL (req.originalUrl)
 * @param {number} durationMs   Response time in milliseconds
 * @param {number} statusCode   HTTP status code
 */
function recordRequest(method, url, durationMs, statusCode) {
    let route = `${method.toUpperCase()} ${normaliseRoute(url)}`;

    // Enforce hard cap on distinct tracked routes to prevent memory leaks from arbitrary URLs
    if (!_samples[route]) {
        const currentRoutes = Object.keys(_samples);
        if (currentRoutes.length >= MAX_TRACKED_ROUTES && !currentRoutes.includes(OVERFLOW_ROUTE_KEY)) {
            route = OVERFLOW_ROUTE_KEY;
        } else if (currentRoutes.length >= MAX_TRACKED_ROUTES) {
            route = OVERFLOW_ROUTE_KEY;
        }
    }

    // Samples — maintain a capped rolling window
    if (!_samples[route]) _samples[route] = [];
    _samples[route].push(durationMs);
    if (_samples[route].length > WINDOW_SIZE) {
        _samples[route].shift();
    }

    // Counters
    if (!_counts[route]) _counts[route] = { total: 0, errors4xx: 0, errors5xx: 0 };
    _counts[route].total++;
    if (statusCode >= 400 && statusCode < 500) _counts[route].errors4xx++;
    if (statusCode >= 500) _counts[route].errors5xx++;
}

/**
 * Compute a percentile from a sorted numeric array.
 *
 * @param {number[]} sorted  Ascending-sorted array
 * @param {number}   p       Percentile in [0, 1]
 * @returns {number}
 */
function percentile(sorted, p) {
    if (!sorted || sorted.length === 0) return 0;
    const idx = Math.ceil(p * sorted.length) - 1;
    return Math.round(sorted[Math.max(0, idx)]);
}

/**
 * Aggregate totals across all routes.
 */
function _totalCounts() {
    let total = 0, errors4xx = 0, errors5xx = 0;
    for (const c of Object.values(_counts)) {
        total    += c.total;
        errors4xx += c.errors4xx;
        errors5xx += c.errors5xx;
    }
    return { total, errors4xx, errors5xx };
}

/**
 * Return a full metrics snapshot.
 *
 * @returns {{
 *   uptimeSeconds: number,
 *   requests: { total: number, errors4xx: number, errors5xx: number },
 *   latency: Record<string, { p50: number, p95: number, p99: number, count: number }>
 * }}
 */
function getSnapshot() {
    const latency = {};
    for (const [route, samples] of Object.entries(_samples)) {
        const sorted = [...samples].sort((a, b) => a - b);
        latency[route] = {
            p50: percentile(sorted, 0.50),
            p95: percentile(sorted, 0.95),
            p99: percentile(sorted, 0.99),
            count: _counts[route]?.total ?? sorted.length
        };
    }

    return {
        uptimeSeconds: Math.round((Date.now() - _startTime) / 1000),
        requests: _totalCounts(),
        latency
    };
}

/**
 * Render the snapshot in Prometheus text exposition format.
 *
 * @returns {string}
 */
function toPrometheusFormat() {
    const snapshot = getSnapshot();
    const lines = [];

    lines.push('# HELP process_uptime_seconds Server uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${snapshot.uptimeSeconds}`);
    lines.push('');

    lines.push('# HELP http_requests_total Total number of HTTP requests handled');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total{result="all"} ${snapshot.requests.total}`);
    lines.push(`http_requests_total{result="4xx"} ${snapshot.requests.errors4xx}`);
    lines.push(`http_requests_total{result="5xx"} ${snapshot.requests.errors5xx}`);
    lines.push('');

    lines.push('# HELP http_request_duration_ms Request latency percentiles in milliseconds');
    lines.push('# TYPE http_request_duration_ms gauge');
    for (const [route, stats] of Object.entries(snapshot.latency)) {
        const label = `route="${route.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        lines.push(`http_request_duration_ms{${label},quantile="0.50"} ${stats.p50}`);
        lines.push(`http_request_duration_ms{${label},quantile="0.95"} ${stats.p95}`);
        lines.push(`http_request_duration_ms{${label},quantile="0.99"} ${stats.p99}`);
    }
    lines.push('');

    return lines.join('\n');
}

/**
 * Reset all in-memory state — used in tests.
 */
function _reset() {
    for (const k of Object.keys(_samples)) delete _samples[k];
    for (const k of Object.keys(_counts))  delete _counts[k];
}

module.exports = { recordRequest, getSnapshot, toPrometheusFormat, normaliseRoute, _reset };
