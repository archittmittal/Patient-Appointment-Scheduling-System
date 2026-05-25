const mysql = require('mysql2/promise');

async function testConnection() {
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

    console.log('Attempting to connect to TiDB...');
    try {
        const connection = await mysql.createConnection(config);
        console.log('✅ Connection successful!');
        
        const [rows] = await connection.query('SELECT DATABASE() as db');
        console.log('✅ Current Database:', rows[0].db);
        
        const [tables] = await connection.query('SHOW TABLES');
        console.log('✅ Tables found:', tables.length);
        
        await connection.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

testConnection();
