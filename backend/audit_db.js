const db = require('./src/config/db');

async function audit() {
    try {
        const [cols] = await db.query('DESCRIBE users');
        const colNames = cols.map(c => c.Field);
        console.log('Columns in users table:', colNames);

        if (!colNames.includes('otp_code')) {
            console.log('Adding otp_code and otp_expiry columns...');
            await db.query('ALTER TABLE users ADD COLUMN otp_code VARCHAR(10) DEFAULT NULL');
            await db.query('ALTER TABLE users ADD COLUMN otp_expiry DATETIME DEFAULT NULL');
            console.log('Columns added successfully.');
        } else {
            console.log('OTP columns already exist.');
        }

        const [users] = await db.query('SELECT id, email, role FROM users');
        console.log('Total users:', users.length);
        
        const nonDemos = users.filter(u => 
            !['patient@example.com', 'dr.sarah@hospital.com', 'dr.michael@hospital.com', 'admin@hospital.com', 'patient@healthsync.com', 'doctor@healthsync.com'].includes(u.email)
        );
        
        console.log('Non-demo users:', nonDemos);
        
        process.exit(0);
    } catch (e) {
        console.error('Audit failed:', e.message);
        process.exit(1);
    }
}

audit();
