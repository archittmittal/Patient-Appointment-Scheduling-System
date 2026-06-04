const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_system',
    port: process.env.DB_PORT || 4000, // TiDB usually uses 4000
    waitForConnections: true,
    connectionLimit: 10,
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
            console.log('Successfully connected to the database.');
            conn.release();
        })
        .catch(err => {
            console.error('Database connection failed:', err.message);
        });
}

// [DEAD-003] Connection pool monitoring — gated behind LOG_LEVEL=debug to prevent
// noisy stdout output in staging/production environments.
const debugLogging = process.env.LOG_LEVEL === 'debug' && process.env.NODE_ENV !== 'test';

pool.on('acquire', (connection) => {
    if (debugLogging) {
        console.log('Connection %d acquired', connection.threadId);
    }
});

pool.on('release', (connection) => {
    if (debugLogging) {
        console.log('Connection %d released', connection.threadId);
    }
});

pool.on('enqueue', () => {
    if (debugLogging) {
        console.warn('Waiting for available connection slot');
    }
});

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

