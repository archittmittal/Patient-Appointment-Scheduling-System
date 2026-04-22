const mysql = require('mysql2/promise');

async function checkSchema() {
    const config = {
        host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
        user: '3HeC9tTGRweL6Sz.root',
        password: 'Password123!',
        database: 'hospital_system',
        port: 4000,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        }
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Connected to check schema.');
        
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM users');
        console.log('✅ Users table found. Row count:', rows[0].count);
        
        await connection.end();
    } catch (err) {
        console.error('❌ Schema check failed:', err.message);
    }
}

checkSchema();
