const mysql = require('mysql2/promise');
require('dotenv').config();

async function cleanup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Archit@123',
        database: process.env.DB_NAME || 'hospital_system'
    });

    try {
        console.log('Cleaning up non-demo users...');
        
        // Define demo user IDs from seed
        const demoUserIds = [1, 2, 3, 10];
        
        // Delete appointments related to non-demo patients or doctors
        // Actually, we can just delete non-demo users and cascade should work, 
        // but let's be safe and delete appointments first if CASCADE isn't on all tables.
        
        // Find users to delete
        const [users] = await connection.execute(
            'SELECT id, email FROM users WHERE id NOT IN (' + demoUserIds.join(',') + ')'
        );
        
        if (users.length === 0) {
            console.log('No non-demo users found.');
            return;
        }
        
        console.log(`Found ${users.length} non-demo users:`, users.map(u => u.email));
        
        for (const user of users) {
            // Appointments use patient_id and doctor_id which are references to patients(id) and doctors(id)
            // which in turn are references to users(id).
            // Delete appointments first to be safe.
            await connection.execute('DELETE FROM appointments WHERE patient_id = ? OR doctor_id = ?', [user.id, user.id]);
            
            // Delete the user (should cascade to patients/doctors table)
            await connection.execute('DELETE FROM users WHERE id = ?', [user.id]);
            console.log(`Deleted user ${user.email} (ID: ${user.id})`);
        }
        
        console.log('Cleanup complete.');
    } catch (err) {
        console.error('Cleanup failed:', err);
    } finally {
        await connection.end();
    }
}

cleanup();
