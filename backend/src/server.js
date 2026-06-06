const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
    express.json()(req, res, next);
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
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Security Middleware
app.use(helmet());

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

// Global Rate Limiter
const rateLimitWindowMins = parseInt(process.env.RATE_LIMIT_WINDOW_MINS, 10) || 15;
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

const globalLimiter = rateLimit({
    windowMs: rateLimitWindowMins * 60 * 1000,
    max: rateLimitMax,
    message: `Too many requests from this IP, please try again after ${rateLimitWindowMins} minutes`
});
app.use('/api/', globalLimiter);

// Auth Rate Limiter (Sensitive Routes)
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 login/register requests per hour
    message: 'Too many authentication attempts, please try again after an hour'
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

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

// Temporary Migration Route
const { authenticate, requireRole } = require('./middleware/authenticate');
app.post('/api/fix-db', authenticate, requireRole('ADMIN'), async (req, res) => {
    if (process.env.ENABLE_DB_FIX !== 'true') {
        return res.status(403).json({ success: false, message: 'Endpoint disabled by configuration' });
    }
    let output = '';
    let failed = false;
    console.log(`[AUDIT] Admin ${req.user.id} initiated /api/fix-db`);
    try {
        const db = require('./config/db');
        try { await db.query(`ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL`); output += 'Step 1 done. '; } catch(e) { failed = true; output += 'Step 1: ' + e.message + '. '; }
        try { await db.query(`ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'LOCAL'`); output += 'Step 2 done. '; } catch(e) { failed = true; output += 'Step 2: ' + e.message + '. '; }
        try { await db.query(`ALTER TABLE users ADD COLUMN google_id VARCHAR(255)`); output += 'Step 3a (add column) done. '; } catch(e) { failed = true; output += 'Step 3a: ' + e.message + '. '; }
        try { await db.query(`CREATE UNIQUE INDEX idx_users_google_id ON users (google_id)`); output += 'Step 3b (unique index) done. '; } catch(e) { failed = true; output += 'Step 3b: ' + e.message + '. '; }
        
        console.log(`[AUDIT] /api/fix-db completed by Admin ${req.user.id}. Failed: ${failed}`);
        
        if (failed) {
            return res.status(500).json({ success: false, message: 'Database fix failed', details: output });
        } else {
            return res.status(200).json({ success: true, message: 'Database fix completed', details: output });
        }
    } catch (e) {
        console.error(`[AUDIT] /api/fix-db outer error: ${e.message}`);
        return res.status(500).json({ success: false, message: 'Database fix encountered a fatal error', details: e.message });
    }
});

// Health check
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

    res.json({
        status: dbStatus.healthy ? 'ok' : 'error',
        message: 'Hospital API is running',
        uptime: process.uptime(),
        database: {
            healthy: dbStatus.healthy,
            error: dbStatus.error,
            stats: dbStats
        },
        scheduler: schedulerStatus,
        performance: performanceStats
    });
});


// Global Error Handler (Must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 7860;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        logger.info(`Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
        // Initialize Background Jobs
        initCronJobs();
    });
}

module.exports = app;
