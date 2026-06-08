const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'hospital_system',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
};

async function main() {
    const shouldCommit = process.argv.includes('--commit');
    console.log('=== Database Orphaned Records Auditing & Cleanup Utility ===');
    console.log(`Execution Mode: ${shouldCommit ? 'COMMIT (Transactional Deletion)' : 'DRY RUN (Auditing Only)'}`);
    console.log('------------------------------------------------------------\n');

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ Successfully connected to database.');

        // 1. Audit orphaned doctors
        const [orphDoctors] = await connection.query(
            'SELECT d.* FROM doctors d LEFT JOIN users u ON d.id = u.id WHERE u.id IS NULL'
        );
        console.log(`[Doctors] Found ${orphDoctors.length} orphaned record(s).`);
        if (orphDoctors.length > 0) {
            console.log(orphDoctors.map(d => `  - ID: ${d.id}, Specialty: ${d.specialty}`));
        }

        // 2. Audit orphaned patients
        const [orphPatients] = await connection.query(
            'SELECT p.* FROM patients p LEFT JOIN users u ON p.id = u.id WHERE u.id IS NULL'
        );
        console.log(`[Patients] Found ${orphPatients.length} orphaned record(s).`);
        if (orphPatients.length > 0) {
            console.log(orphPatients.map(p => `  - ID: ${p.id}`));
        }

        // 3. Audit orphaned appointments
        const [orphAppointments] = await connection.query(
            'SELECT a.* FROM appointments a LEFT JOIN users u_doc ON a.doctor_id = u_doc.id LEFT JOIN users u_pat ON a.patient_id = u_pat.id WHERE u_doc.id IS NULL OR u_pat.id IS NULL'
        );
        console.log(`[Appointments] Found ${orphAppointments.length} orphaned record(s).`);
        if (orphAppointments.length > 0) {
            console.log(orphAppointments.map(a => `  - ID: ${a.id}, Date: ${a.appointment_date}, DoctorID: ${a.doctor_id}, PatientID: ${a.patient_id}`));
        }

        const hasOrphans = orphDoctors.length > 0 || orphPatients.length > 0 || orphAppointments.length > 0;

        if (!hasOrphans) {
            console.log('\n✓ No orphaned records found in database. Referential integrity is intact.');
            return;
        }

        // Write audit log to local file
        const auditLogPath = path.join(__dirname, 'orphaned_records_audit.json');
        const auditPayload = {
            timestamp: new Date().toISOString(),
            orphanedDoctors: orphDoctors,
            orphanedPatients: orphPatients,
            orphanedAppointments: orphAppointments
        };
        fs.writeFileSync(auditLogPath, JSON.stringify(auditPayload, null, 2), 'utf8');
        console.log(`\n✓ Audit log written to: ${auditLogPath}`);

        if (!shouldCommit) {
            console.log('\n[Tip] Run with the flag "--commit" to execute the deletion transaction.');
            return;
        }

        // Perform transactional deletions
        console.log('\nStarting database cleanup transaction...');
        await connection.beginTransaction();

        if (orphAppointments.length > 0) {
            const appointmentIds = orphAppointments.map(a => a.id);
            await connection.query('DELETE FROM appointments WHERE id IN (?)', [appointmentIds]);
            console.log(`- Deleted ${appointmentIds.length} orphaned appointments.`);
        }

        if (orphDoctors.length > 0) {
            const doctorIds = orphDoctors.map(d => d.id);
            await connection.query('DELETE FROM doctors WHERE id IN (?)', [doctorIds]);
            console.log(`- Deleted ${doctorIds.length} orphaned doctors.`);
        }

        if (orphPatients.length > 0) {
            const patientIds = orphPatients.map(p => p.id);
            await connection.query('DELETE FROM patients WHERE id IN (?)', [patientIds]);
            console.log(`- Deleted ${patientIds.length} orphaned patients.`);
        }

        await connection.commit();
        console.log('✓ Transaction committed successfully. Cleanup complete.');

    } catch (err) {
        if (connection && shouldCommit) {
            console.error('Error during cleanup, rolling back transaction...');
            await connection.rollback();
        }
        console.error('Execution failed:', err);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n✓ Database connection closed.');
        }
    }
}

main();
