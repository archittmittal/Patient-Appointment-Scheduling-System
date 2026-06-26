const mysql = require('mysql2/promise');
const logger = require('./logger');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_system',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 100,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    } : null
};

const pool = mysql.createPool(dbConfig);

if (process.env.NODE_ENV !== 'test') {
    pool.getConnection()
        .then(conn => {
            logger.info('Successfully connected to the database.');
            conn.release();
        })
        .catch(err => {
            logger.error('Database connection failed: ' + err.message, { error: err });
        });
}

// Connection pool monitoring events - pipe to structured logger
pool.on('acquire', (connection) => {
    logger.debug('Connection acquired from pool', { threadId: connection.threadId });
});

pool.on('release', (connection) => {
    logger.debug('Connection released back to pool', { threadId: connection.threadId });
});

pool.on('enqueue', () => {
    logger.warn('Connection pool saturated. Waiting for available connection slot.');
});

// Helper to log slow queries
function checkSlowQuery(start, args, type) {
    const duration = Date.now() - start;
    const slowThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 100;
    if (duration > slowThreshold) {
        const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].sql ? args[0].sql : 'Unknown SQL');
        const sanitizedSql = sql.replace(/\s+/g, ' ').trim();
        logger.warn(`Slow Database Query (${duration}ms) via ${type}: ${sanitizedSql.substring(0, 250)}...`, {
            durationMs: duration,
            sql: sanitizedSql,
            type
        });
    }
}

// Wrap pool query and execute methods
const originalPoolQuery = pool.query;
pool.query = async function(...args) {
    const start = Date.now();
    try {
        const result = await originalPoolQuery.apply(this, args);
        checkSlowQuery(start, args, 'pool.query');
        return result;
    } catch (err) {
        const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].sql ? args[0].sql : 'Unknown SQL');
        logger.error(`Database Query Error: ${err.message}`, { sql, error: err });
        throw err;
    }
};

const originalPoolExecute = pool.execute;
pool.execute = async function(...args) {
    const start = Date.now();
    try {
        const result = await originalPoolExecute.apply(this, args);
        checkSlowQuery(start, args, 'pool.execute');
        return result;
    } catch (err) {
        const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].sql ? args[0].sql : 'Unknown SQL');
        logger.error(`Database Execute Error: ${err.message}`, { sql, error: err });
        throw err;
    }
};

// Wrap getConnection to wrap individual connection query and execute methods
const originalGetConnection = pool.getConnection;
pool.getConnection = async function(...args) {
    const conn = await originalGetConnection.apply(this, args);
    
    const originalConnQuery = conn.query;
    conn.query = async function(...cArgs) {
        const start = Date.now();
        try {
            const result = await originalConnQuery.apply(this, cArgs);
            checkSlowQuery(start, cArgs, 'connection.query');
            return result;
        } catch (err) {
            const sql = typeof cArgs[0] === 'string' ? cArgs[0] : (cArgs[0] && cArgs[0].sql ? cArgs[0].sql : 'Unknown SQL');
            logger.error(`Database Connection Query Error: ${err.message}`, { sql, error: err });
            throw err;
        }
    };

    const originalConnExecute = conn.execute;
    if (originalConnExecute) {
        conn.execute = async function(...cArgs) {
            const start = Date.now();
            try {
                const result = await originalConnExecute.apply(this, cArgs);
                checkSlowQuery(start, cArgs, 'connection.execute');
                return result;
            } catch (err) {
                const sql = typeof cArgs[0] === 'string' ? cArgs[0] : (cArgs[0] && cArgs[0].sql ? cArgs[0].sql : 'Unknown SQL');
                logger.error(`Database Connection Execute Error: ${err.message}`, { sql, error: err });
                throw err;
            }
        };
    }

    return conn;
};

pool.getPoolStats = function() {
    const rawPool = pool.pool;
    if (!rawPool) return null;
    const all = rawPool._allConnections ? rawPool._allConnections.length : 0;
    const free = rawPool._freeConnections ? rawPool._freeConnections.length : 0;
    const queue = rawPool._connectionQueue ? rawPool._connectionQueue.length : 0;
    return {
        activeConnections: all - free,
        idleConnections: free,
        pendingQueries: queue,
        connectionLimit: dbConfig.connectionLimit
    };
};

module.exports = pool;

