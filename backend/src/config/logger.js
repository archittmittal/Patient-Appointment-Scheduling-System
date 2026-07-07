const winston = require('winston');
const path = require('path');
let DailyRotateFile;
try {
    DailyRotateFile = require('winston-daily-rotate-file');
} catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
        throw err;
    }
    // Optional dependency — gracefully omit file transport when not installed
    DailyRotateFile = null;
}

// Determine log level (default to 'info' in production/staging, 'debug' in dev/test)
const defaultLogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const logLevel = process.env.LOG_LEVEL || defaultLogLevel;

// ── Formats ──────────────────────────────────────────────────────────────────

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

// ── Transports ────────────────────────────────────────────────────────────────

const transports = [
    new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true
    })
];

// Daily-rotating file transport — persists logs across container restarts.
// Directory: <project-root>/logs/  (created automatically by winston-daily-rotate-file)
// Retention: 14 days   Max size: 20 MB / file
if (DailyRotateFile && process.env.NODE_ENV !== 'test') {
    const logsDir = path.join(process.cwd(), 'logs');

    const appLogTransport = new DailyRotateFile({
        filename: path.join(logsDir, 'app-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: productionFormat,
        handleExceptions: true,
        handleRejections: true
    });

    appLogTransport.on('error', (err) => {
        console.error('Winston DailyRotateFile appLogTransport error:', err);
    });

    transports.push(appLogTransport);

    // Separate error-only log file — easier to grep production incidents
    const errorLogTransport = new DailyRotateFile({
        level: 'error',
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        format: productionFormat
    });

    errorLogTransport.on('error', (err) => {
        console.error('Winston DailyRotateFile errorLogTransport error:', err);
    });

    transports.push(errorLogTransport);
}

// ── Logger instance ───────────────────────────────────────────────────────────

const logger = winston.createLogger({
    level: logLevel,
    format: currentFormat,
    transports,
    exitOnError: false
});

/**
 * Returns the list of active transports — useful for test assertions.
 * @returns {winston.transport[]}
 */
logger.getTransports = () => transports;

module.exports = logger;
