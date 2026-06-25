const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function applyMigrations() {
    const migrationsDir = __dirname;
    const migrationFiles = [
        'migration_week4_billing.sql',
        'migration_week4_messaging.sql',
        'migration_sprint2_schema_hardening.sql',
        'migrations/migration_sprint3_consultation_fee.sql',
        'migrations/migration_sprint4_otp_hardening.sql',
        'migrations/migration_sprint8_indexes_fk.sql',
        'migrations/migration_sprint10_uppercase_status.sql',
        'migrations/migration_sprint11_symptom_checker.sql',
        'migrations/migration_sprint11_departments.sql',
        'migrations/migration_sprint12_consent_logs.sql',
        'migrations/migration_sprint13_abha_support.sql',
        'migration_advanced_portal.sql',
        'migration_issue144_medical_data.sql'
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

        for (let statement of statements) {
            // Preprocess standard MySQL incompatible IF NOT EXISTS clauses
            statement = statement
                .replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN')
                .replace(/ADD\s+IF\s+NOT\s+EXISTS/gi, 'ADD')
                .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE INDEX')
                .replace(/DROP\s+INDEX\s+IF\s+EXISTS/gi, 'DROP INDEX');

            try {
                await db.query(statement);
            } catch (error) {
                // If column already exists or table exists, we might get an error depending on SQL
                if (
                    error.code === 'ER_DUP_FIELDNAME' || 
                    error.code === 'ER_TABLE_EXISTS_ERROR' || 
                    error.code === 'ER_DUP_KEYNAME' ||
                    error.code === 'ER_FK_DUP_NAME' ||
                    error.code === 'ER_CANT_DROP_FIELD_OR_KEY'
                ) {
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
