const Joi = require('joi');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(7860),
    
    // Database
    DB_HOST: Joi.string().required().description('Database host name'),
    DB_USER: Joi.string().required().description('Database user name'),
    DB_PASSWORD: Joi.string().allow('').default(''),
    DB_NAME: Joi.string().required().description('Database name'),
    
    // Security
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    ALLOWED_ORIGINS: Joi.string()
        .default('http://localhost:5173,http://localhost:3000')
        .description('Comma-separated list of allowed origins for CORS'),
    
    // Email (Nodemailer)
    EMAIL_USER: Joi.string().email().optional(),
    EMAIL_PASS: Joi.string().optional(),
    
    // Notifications (Web Push)
    VAPID_PUBLIC_KEY: Joi.string().optional(),
    VAPID_PRIVATE_KEY: Joi.string().optional(),
    
    // SMS (Twilio)
    TWILIO_ACCOUNT_SID: Joi.string().optional(),
    TWILIO_AUTH_TOKEN: Joi.string().optional(),
    TWILIO_PHONE_NUMBER: Joi.string().optional(),
    
    // App Links
    APP_URL: Joi.string().uri().default('http://localhost:5173')
}).unknown().required();

const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
    console.error('\x1b[31m%s\x1b[0m', `Config validation error: ${error.message}`);
    process.exit(1);
}

const config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    db: {
        host: envVars.DB_HOST,
        user: envVars.DB_USER,
        password: envVars.DB_PASSWORD,
        name: envVars.DB_NAME
    },
    jwt: {
        secret: envVars.JWT_SECRET
    },
    cors: {
        allowedOrigins: envVars.ALLOWED_ORIGINS.split(',')
    },
    email: {
        user: envVars.EMAIL_USER,
        pass: envVars.EMAIL_PASS
    },
    webPush: {
        publicKey: envVars.VAPID_PUBLIC_KEY,
        privateKey: envVars.VAPID_PRIVATE_KEY
    },
    twilio: {
        accountSid: envVars.TWILIO_ACCOUNT_SID,
        authToken: envVars.TWILIO_AUTH_TOKEN,
        phoneNumber: envVars.TWILIO_PHONE_NUMBER
    },
    appUrl: envVars.APP_URL
};

module.exports = config;
