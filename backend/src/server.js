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
const expressCheckinRoutes = require('./routes/expressCheckin'); // Issue #45
const batchingRoutes = require('./routes/batching');
const prepChecklistRoutes = require('./routes/prepChecklist');
const multiDoctorRoutes = require('./routes/multiDoctor');
const lateArrivalRoutes = require('./routes/lateArrival');
const feedbackRoutes = require('./routes/feedback');
const insuranceRoutes = require('./routes/insurance');
const paymentRoutes = require('./routes/payments');
const messageRoutes = require('./routes/messages');
const exportRoutes = require('./routes/export');
const errorHandler = require('./middleware/errorHandler');
const { initCronJobs } = require('./jobs/reminderJobs');

const app = express();

// Parse JSON for all routes EXCEPT the Stripe webhook (which needs the raw body for signature verification)
app.use((req, res, next) => {
    if (req.originalUrl === '/api/payments/webhook') {
        return next();
    }
    express.json()(req, res, next);
});

// [BUG-009] Debug Logger — only active in non-production environments
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });
}

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
                url: 'http://localhost:7860',
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
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
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
app.use('/api/express-checkin', expressCheckinRoutes); // Issue #45
app.use('/api/batching', batchingRoutes);
app.use('/api/prep', prepChecklistRoutes);
app.use('/api/multi-doctor', multiDoctorRoutes);
app.use('/api/late-arrival', lateArrivalRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/export', exportRoutes);

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

    res.json({
        status: dbStatus.healthy ? 'ok' : 'error',
        message: 'Hospital API is running',
        uptime: process.uptime(),
        database: {
            healthy: dbStatus.healthy,
            error: dbStatus.error,
            stats: dbStats
        },
        scheduler: schedulerStatus
    });
});


// Global Error Handler (Must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 7860;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        // Initialize Background Jobs
        initCronJobs();
    });
}

module.exports = app;
