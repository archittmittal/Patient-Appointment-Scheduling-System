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

// Test connection on startup
pool.getConnection()
    .then(conn => {
        console.log('Successfully connected to the database.');
        conn.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
    });

module.exports = pool;
