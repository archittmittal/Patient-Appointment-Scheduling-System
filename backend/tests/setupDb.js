const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function preprocessSQL(statement) {
    return statement
        .replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN')
        .replace(/ADD\s+IF\s+NOT\s+EXISTS/gi, 'ADD')
        .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, 'CREATE INDEX')
        .replace(/DROP\s+INDEX\s+IF\s+EXISTS/gi, 'DROP INDEX');
}

function splitSQL(sql) {
    const statements = [];
    let current = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inEscape = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        const next = sql[i + 1];

        if (inEscape) {
            current.push(char);
            inEscape = false;
            continue;
        }

        if (inLineComment) {
            if (char === '\n' || char === '\r') {
                inLineComment = false;
            }
            continue;
        }

        if (inBlockComment) {
            if (char === '*' && next === '/') {
                inBlockComment = false;
                i++;
            }
            continue;
        }

        if (char === '-' && next === '-') {
            inLineComment = true;
            i++;
            continue;
        }

        if (char === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }

        if (char === '\\') {
            current.push(char);
            inEscape = true;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            current.push(char);
            continue;
        }

        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            current.push(char);
            continue;
        }

        if (char === ';' && !inSingleQuote && !inDoubleQuote) {
            const stmt = current.join('').trim();
            if (stmt) statements.push(stmt);
            current = [];
            continue;
        }

        current.push(char);
    }

    const last = current.join('').trim();
    if (last) statements.push(last);

    return statements;
}

async function setupTestDb() {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const port = parseInt(process.env.DB_PORT, 10) || 3306;
    const database = 'hospital_system_test';

    // 1. Temporary connection to create/recreate database
    const conn = await mysql.createConnection({ host, user, password, port });
    try {
        await conn.query(`DROP DATABASE IF EXISTS ${database}`);
        await conn.query(`CREATE DATABASE ${database}`);
    } finally {
        await conn.end();
    }

    // 2. Connect directly to hospital_system_test
    const testDb = await mysql.createConnection({ host, user, password, port, database });
    try {
        console.log(`[Test DB Setup] Database ${database} created. Disabling foreign key checks and initializing schema...`);
        await testDb.query('SET FOREIGN_KEY_CHECKS = 0');

        // 3. Read and apply schema.sql
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        const schemaStatements = splitSQL(schemaSql).filter(s => {
            const lower = s.toLowerCase();
            return !lower.startsWith('create database') && !lower.startsWith('use ');
        });

        for (const statement of schemaStatements) {
            await testDb.query(statement);
        }

        // 3b. Read and apply seed.sql
        const seedPath = path.join(__dirname, '../database/seed.sql');
        if (fs.existsSync(seedPath)) {
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            const seedStatements = splitSQL(seedSql).filter(s => {
                const lower = s.toLowerCase();
                return !lower.startsWith('use ');
            });
            for (const statement of seedStatements) {
                await testDb.query(statement);
            }
        }

        console.log(`[Test DB Setup] Schema and seed applied. Applying migrations...`);

        // 4. Apply migrations in order
        const migrationsDir = path.join(__dirname, '../database');
        const migrationFiles = [
            'migration_notifications_preferences_and_logs.sql',
            'migration_virtual_waiting_room_and_checkin.sql',
            'migration_delay_propagation_and_alerts.sql',
            'migration_noshow_prediction_and_autofill.sql',
            'migration_walkin_patient_prioritization.sql',
            'migration_fix_patient_and_doctor_profiles.sql',
            'migration_multi_doctor_referral_journeys.sql',
            'migration_express_checkin_and_triage.sql',
            'migration_pre_consultation_checklists.sql',
            'migration_late_arrival_management.sql',
            'migration_consultation_duration_prediction.sql',
            'migration_notification_batch_queues.sql',
            'migration_feedback_loops_and_analytics.sql',
            'migration_fix_appointment_schema_inconsistencies.sql',
            'migration_stripe_payment_billing.sql',
            'migration_patient_doctor_messaging_threads.sql',
            'migration_security_and_schema_hardening.sql',
            'migrations/migration_sprint3_doctor_consultation_fee.sql',
            'migrations/migration_sprint4_secure_otp_hardening.sql',
            'migrations/migration_sprint8_indexes_and_foreign_keys.sql',
            'migrations/migration_sprint10_standardize_uppercase_status.sql',
            'migrations/migration_sprint11_symptom_checker_triage.sql',
            'migrations/migration_sprint11_clinical_departments.sql',
            'migrations/migration_sprint12_dpdp_consent_logs.sql',
            'migrations/migration_sprint13_abha_id_support.sql',
            'migration_advanced_clinical_prescriptions.sql',
            'migration_vitals_spo2_and_drug_interactions.sql',
            'migrations/migration_sprint14_booking_slot_capacity.sql',
            'migrations/migration_sprint15_secure_refresh_tokens.sql'
        ];

        for (const file of migrationFiles) {
            const filePath = path.join(migrationsDir, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`[Test DB Setup Error] Required migration file not found: ${file}`);
            }

            const sql = fs.readFileSync(filePath, 'utf8');
            const statements = splitSQL(sql).filter(s => {
                const lower = s.toLowerCase().trim();
                return !lower.startsWith('use ');
            });
            console.log(`[Test DB Setup] File: ${file}, Statements: ${statements.length}`);

            for (const statement of statements) {
                const preprocessed = preprocessSQL(statement);
                try {
                    await testDb.query(preprocessed);
                } catch (error) {
                    const isDuplicate = 
                        error.code === 'ER_DUP_FIELDNAME' || 
                        error.code === 'ER_TABLE_EXISTS_ERROR' || 
                        error.code === 'ER_DUP_KEYNAME' ||
                        error.code === 'ER_FK_DUP_NAME' ||
                        error.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
                        error.code === 'ER_DUP_ENTRY' ||
                        error.errno === 1062 ||
                        (error.message && error.message.includes('Duplicate entry'));

                    if (isDuplicate) {
                        console.log(`[Test DB Setup] Suppressed duplicate error in ${file}: ${error.code} - ${error.message.substring(0, 100)}`);
                    } else {
                        console.error(`[Test DB Setup Error] Failed to execute statement in ${file}: ${preprocessed.substring(0, 100)}...`);
                        console.error(`[Reason] ${error.message} (Code: ${error.code}, Errno: ${error.errno})`);
                        throw error;
                    }
                }
            }
        }
    } finally {
        console.log(`[Test DB Setup] Re-enabling foreign key checks...`);
        try {
            await testDb.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (err) {
            console.error('[Test DB Setup] Failed to re-enable foreign key checks:', err.message);
        }
        await testDb.end();
    }
}

module.exports = setupTestDb;
