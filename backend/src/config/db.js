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

// Connection pool monitoring
pool.on('acquire', (connection) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('Connection %d acquired', connection.threadId);
    }
});

pool.on('release', (connection) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('Connection %d released', connection.threadId);
    }
});

pool.on('enqueue', () => {
    if (process.env.NODE_ENV !== 'test') {
        console.warn('Waiting for available connection slot');
    }
});

module.exports = pool;
