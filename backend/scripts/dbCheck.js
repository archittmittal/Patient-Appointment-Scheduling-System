const db = require('../src/config/db');

async function checkDatabase() {
    console.log('--- Database Integrity Check ---');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('Database:', process.env.DB_NAME || 'hospital_system');
    
    try {
        const start = Date.now();
        const [rows] = await db.query('SELECT 1 as connected');
        const end = Date.now();
        
        if (rows[0].connected === 1) {
            console.log('✅ Connectivity: OK (Latency: %dms)', end - start);
        }

        // Check if tables exist
        const [tables] = await db.query('SHOW TABLES');
        console.log('✅ Tables Found: %d', tables.length);
        
        // Specific check for core tables
        const coreTables = ['users', 'patients', 'doctors', 'appointments', 'live_queue'];
        const tableNames = tables.map(t => Object.values(t)[0]);
        
        coreTables.forEach(table => {
            if (tableNames.includes(table)) {
                console.log('   - %s: Found', table);
            } else {
                console.error('   - %s: MISSING ❌', table);
            }
        });

        console.log('--- Check Complete ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database Check Failed:', err.message);
        process.exit(1);
    }
}

checkDatabase();
