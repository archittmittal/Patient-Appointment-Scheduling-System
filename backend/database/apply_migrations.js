const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function applyMigrations() {
    const migrationsDir = __dirname;
    const migrationFiles = [
        'migration_week4_billing.sql',
        'migration_week4_messaging.sql',
        'migration_sprint2_schema_hardening.sql'
    ];

    console.log('--- Starting Migration Verification ---');

    for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`[Warning] Migration file not found: ${file}`);
            continue;
        }

        console.log(`[Applying] ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        
        // Split by semicolon but ignore inside quotes
        const statements = sql
            .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await db.query(statement);
            } catch (error) {
                // If column already exists or table exists, we might get an error depending on SQL
                if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME') {
                    console.log(`  [Info] Already applied or exists: ${statement.substring(0, 50)}...`);
                } else {
                    console.error(`  [Error] Failed to execute: ${statement.substring(0, 50)}...`);
                    console.error(`  [Reason] Code: ${error.code}, Message: ${error.message}`);
                    console.error(error);
                }
            }
        }
        console.log(`[Success] Finished ${file}`);
    }

    console.log('--- Migration Verification Complete ---');
    process.exit(0);
}

applyMigrations().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
