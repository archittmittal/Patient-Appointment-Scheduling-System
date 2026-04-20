const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

const app = express();

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
    },
    apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Hospital API is running' });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);


const PORT = process.env.PORT || 7860;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

module.exports = app;
