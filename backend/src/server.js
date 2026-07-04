const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();

const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const virtualCheckinRoutes = require('./routes/virtualCheckin'); // Issue #39
const analyticsRoutes = require('./routes/analytics'); // Issue #44
const walkinRoutes = require('./routes/walkin'); // Issue #42
const multiDoctorRoutes = require('./routes/multiDoctor');
const feedbackRoutes = require('./routes/feedback');
const insuranceRoutes = require('./routes/insurance');
const paymentRoutes = require('./routes/payments');
const messageRoutes = require('./routes/messages');
const exportRoutes = require('./routes/export');
const symptomCheckerRoutes = require('./routes/symptomChecker');
const departmentRoutes = require('./routes/departments');
const prescriptionRoutes = require('./routes/prescriptions');
const errorHandler = require('./middleware/errorHandler');
const { initCronJobs } = require('./jobs/reminderJobs');
const logger = require('./config/logger');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// Parse JSON for all routes EXCEPT the Stripe webhook (which needs the raw body for signature verification)
app.use((req, res, next) => {
    if (req.originalUrl === '/api/payments/webhook') {
        return next();
    }
    express.json({ limit: '1mb' })(req, res, next);
});

// Structured request logging middleware (Morgan + Winston)
app.use(requestLogger);

// Root Route (Moved to top for visibility)
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Hospital Management API is running', version: '1.0.1' });
});

// Issue #92: Swagger API Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hospital Management API',
            version: '1.0.0',
            description: 'API documentation for the Patient Appointment Scheduling System',
        },
        servers: [
            {
                url: process.env.APP_URL || 'http://localhost:7860',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./src/routes/*.js', './src/server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
if (process.env.NODE_ENV !== 'production') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Security Middleware — baseline Helmet (CSP configured after origins are resolved below)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,   // set via a dedicated middleware below once origins are known
}));

// Response compression (gzip/brotli) — reduces payload 2–5× for JSON-heavy API responses
app.use(compression());

// Strict CORS
function normalizeOrigin(value) {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
        return new URL(trimmed).origin;
    } catch {
        return trimmed;
    }
}

const whitelist = new Set([
    ...(process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : []),
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : [])
].map(normalizeOrigin).filter(Boolean));

// [SEC-008] CORS: whitelist-only in production; localhost pass-through in development.
// Add specific deployment URLs to ALLOWED_ORIGINS env var — never use platform-wide wildcards.
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
        if (!origin) return callback(null, true);

        const normalizedOrigin = normalizeOrigin(origin);

        // 1. Allow explicitly whitelisted origins (from env var or APP_URL/FRONTEND_URL)
        if (whitelist.has(normalizedOrigin)) return callback(null, true);

        // 2. In development, allow any localhost / 127.0.0.1 variant
        if (process.env.NODE_ENV !== 'production') {
            if (
                /^https?:\/\/localhost:\d+$/.test(origin) ||
                /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)
            ) {
                return callback(null, true);
            }
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
};
app.use(cors(corsOptions));

// ── Content Security Policy ───────────────────────────────────────────────────
// Applied AFTER the CORS whitelist is built so connect-src stays in sync with the
// allowed origins. The API serves JSON to the SPA; scripts/styles are loaded by
// the frontend bundle, not here, so directives are intentionally restrictive.
app.use(helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
        defaultSrc: ["'self'"],
        // The SPA connects to this API plus any whitelisted deployment origins
        connectSrc: ["'self'", ...whitelist],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
    },
}));

// ── Global Rate Limiter ────────────────────────────────────────────────────────
// Reads window/max from env so production can be tuned without code changes.
// standardHeaders: true  → emits RateLimit-Limit / RateLimit-Remaining / Retry-After (RFC 6585)
// legacyHeaders: false   → suppresses X-RateLimit-* to keep responses uncluttered
const rateLimitWindowMins = parseInt(process.env.RATE_LIMIT_WINDOW_MINS, 10) || 15;
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

const globalLimiter = rateLimit({
    windowMs: rateLimitWindowMins * 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: 'fail',
            code: 'TOO_MANY_REQUESTS',
            message: `Too many requests from this IP — please try again after ${rateLimitWindowMins} minutes.`,
        });
    },
});

// ── Auth Rate Limiter (Brute-force Protection) ─────────────────────────────────
// Tighter window specifically for login / register to resist credential stuffing.
// 10 attempts per hour per IP — legitimate users will never hit this.
//
// keyGenerator includes req.path so /login and /register maintain independent
// counters per IP. Without this, exhausting the /login budget would immediately
// block /register attempts from the same IP (and vice-versa).
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}::${req.path}`,
    handler: (req, res) => {
        res.status(429).json({
            status: 'fail',
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many authentication attempts — please try again after 1 hour.',
        });
    },
});

if (process.env.DISABLE_RATE_LIMITER !== 'true') {
    app.use('/api/', globalLimiter);
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
    app.use('/api/auth/forgot-password', authLimiter);
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/virtual-checkin', virtualCheckinRoutes); // Issue #39
app.use('/api/analytics', analyticsRoutes); // Issue #44
app.use('/api/walkin', walkinRoutes); // Issue #42
app.use('/api/multi-doctor', multiDoctorRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/symptom-checker', symptomCheckerRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

// ============================================================================
// Monitoring & Health Probes (Issue #122 / Day 14)
// ============================================================================

const net = require('net');

/**
 * Helper to check Redis connection via a TCP socket probe.
 * Returns a promise resolving to the health status of Redis.
 */
async function checkRedisHealth() {
    const host = process.env.REDIS_HOST;
    const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
    const url = process.env.REDIS_URL;

    // If no Redis connection parameters are configured, it is considered disabled (healthy fallback)
    if (!host && !url) {
        return { healthy: true, status: 'disabled', message: 'Redis is not configured' };
    }

    let targetHost = host || 'localhost';
    let targetPort = port;

    if (url) {
        try {
            const parsed = new URL(url);
            targetHost = parsed.hostname;
            targetPort = parseInt(parsed.port, 10) || 6379;
        } catch (e) {
            return { healthy: false, status: 'error', error: 'Invalid REDIS_URL format: ' + e.message };
        }
    }

    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000); // 2 second timeout for connection probe

        socket.on('connect', () => {
            socket.destroy();
            resolve({ healthy: true, status: 'connected' });
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve({ healthy: false, status: 'error', error: err.message });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ healthy: false, status: 'timeout', error: 'Connection timed out (2000ms)' });
        });

        socket.connect(targetPort, targetHost);
    });
}

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Retrieve detailed system health and performance telemetry
 *     description: Exposes system uptime, database status, cron scheduler metadata, and process performance statistics (CPU/Memory).
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Telemetry successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get('/api/health', async (req, res) => {
    let dbStatus = { healthy: false, error: null };
    let dbStats = null;

    try {
        const db = require('./config/db');
        // Simple query check
        await db.query('SELECT 1');
        dbStatus.healthy = true;
        
        if (typeof db.getPoolStats === 'function') {
            dbStats = db.getPoolStats();
        }
    } catch (err) {
        dbStatus.error = err.message;
    }

    const { getCronStatus } = require('./jobs/reminderJobs');
    const schedulerStatus = typeof getCronStatus === 'function' ? getCronStatus() : null;

    // Collect process and system performance telemetry
    const memUsage = process.memoryUsage();
    const performanceStats = {
        memory: {
            rssMb: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
            heapTotalMb: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
            heapUsedMb: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
            externalMb: Math.round((memUsage.external / 1024 / 1024) * 100) / 100
        },
        cpu: process.cpuUsage(),
        nodeVersion: process.version
    };

    const sseManager = require('./services/sseManager');
    const sseConnectionsCount = typeof sseManager.getActiveConnectionsCount === 'function'
        ? sseManager.getActiveConnectionsCount()
        : 0;

    res.json({
        status: dbStatus.healthy ? 'ok' : 'error',
        message: 'Hospital API is running',
        uptime: process.uptime(),
        sseConnections: sseConnectionsCount,
        database: {
            healthy: dbStatus.healthy,
            error: dbStatus.error,
            stats: dbStats
        },
        scheduler: schedulerStatus,
        performance: performanceStats
    });
});

/**
 * @swagger
 * /healthz:
 *   get:
 *     summary: Simple health probe for container orchestrators and load balancers
 *     description: Checks MySQL database and Redis connection health. Returns HTTP 200 if both connections are healthy, and HTTP 503 if any required service is down.
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Both MySQL database and Redis connections are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       503:
 *         description: One or more critical connections are unhealthy
 */
app.get(['/healthz', '/api/healthz'], async (req, res) => {
    let dbHealthy = false;
    let dbError = null;

    try {
        const db = require('./config/db');
        await db.query('SELECT 1');
        dbHealthy = true;
    } catch (err) {
        dbError = err.message;
    }

    const redisStatus = await checkRedisHealth();
    const overallHealthy = dbHealthy && redisStatus.healthy;

    const responsePayload = {
        status: overallHealthy ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        database: {
            healthy: dbHealthy,
            error: dbError
        },
        redis: redisStatus
    };

    if (overallHealthy) {
        res.status(200).json(responsePayload);
    } else {
        res.status(503).json(responsePayload);
    }
});


// Global Error Handler (Must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 7860;
if (process.env.NODE_ENV !== 'test') {
    const server = app.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
        // Initialize Background Jobs
        initCronJobs();

        // Run database migrations programmatically on startup (forked child process)
        try {
            const { fork } = require('child_process');
            const path = require('path');
            const migrationProcess = fork(path.join(__dirname, '../database/apply_migrations.js'));
            migrationProcess.on('exit', (code) => {
                if (code === 0) {
                    logger.info('Database migrations verified and applied successfully.');
                } else {
                    logger.error(`Database migrations failed to execute (exit code: ${code}).`);
                }
            });
        } catch (migError) {
            logger.error('Failed to initiate migrations child process:', migError);
        }
    });

    // ── Graceful Shutdown ──────────────────────────────────────────────────────
    // On SIGTERM (container orchestrators) / SIGINT (Ctrl-C), stop accepting new
    // connections, drain the MySQL pool, and exit cleanly so in-flight requests
    // are not dropped on deploys / restarts.
    let shuttingDown = false;
    async function shutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info(`Received ${signal} — shutting down gracefully`);

        // Force-exit if cleanup takes longer than the timeout
        const forceExit = setTimeout(() => {
            logger.error('Graceful shutdown timed out — forcing exit');
            process.exit(1);
        }, 10000);
        forceExit.unref();

        server.close((err) => {
            if (err) logger.error('Error closing HTTP server:', err);

            try {
                const db = require('./config/db');
                db.end().then(() => {
                    logger.info('Database pool closed');
                    process.exit(err ? 1 : 0);
                }).catch((dbErr) => {
                    logger.error('Error closing database pool:', dbErr);
                    process.exit(1);
                });
            } catch {
                // DB module not loaded — exit once HTTP server is closed
                process.exit(err ? 1 : 0);
            }
        });
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
