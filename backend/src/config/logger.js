const winston = require('winston');

// Determine log level (default to 'info' in production/staging, 'debug' in dev/test)
const defaultLogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const logLevel = process.env.LOG_LEVEL || defaultLogLevel;

// Define logging formats
const errorStackFormat = winston.format((info) => {
    if (info instanceof Error) {
        info.message = info.message;
        info.stack = info.stack;
    } else if (info.stack) {
        // If stack is passed explicitly as metadata
        info.message = `${info.message}`;
    }
    return info;
});

const developmentFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
        const metaStr = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}${stackStr}`;
    })
);

const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    errorStackFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const currentFormat = process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat;

// Create the winston logger instance
const logger = winston.createLogger({
    level: logLevel,
    format: currentFormat,
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true
        })
    ],
    exitOnError: false
});

module.exports = logger;
