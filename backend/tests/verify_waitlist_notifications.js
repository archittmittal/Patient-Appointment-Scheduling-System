const pool = require('../src/config/db');
const waitlistService = require('../src/services/waitlistService');

async function runTests() {
    console.log('=== Starting Waitlist Offer Notifications Verification ===\n');
    try {
        // 1. Fetch a valid patient and doctor to create test setup
        const [patients] = await pool.query('SELECT id FROM patients LIMIT 1');
        if (patients.length === 0) {
            throw new Error('No patients found in database. Please seed first.');
        }
        const patientId = patients[0].id;

        const [doctors] = await pool.query('SELECT id FROM doctors LIMIT 1');
        if (doctors.length === 0) {
            throw new Error('No doctors found in database. Please seed first.');
        }
        const doctorId = doctors[0].id;

        console.log(`Using Patient ID: ${patientId}, Doctor ID: ${doctorId} for testing.`);

        // 2. Prepare dynamic dates
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        const randomMinute = String(Math.floor(Math.random() * 50) + 10);
        const timeStr = `10:${randomMinute}:00`;

        // Clean up pre-existing test waitlist entries and appointments to prevent constraint errors
        await pool.query(
            "DELETE FROM waitlist WHERE patient_id = ? AND doctor_id = ? AND preferred_date = ?",
            [patientId, doctorId, dateStr]
        );
        await pool.query(
            "DELETE FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ?",
            [doctorId, dateStr, timeStr]
        );

        // 3. Create a mock appointment that will be released
        const [apptResult] = await pool.query(
            `INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, status, symptoms)
             VALUES (?, ?, ?, ?, 'SCHEDULED', 'Mock Test Release appt')`,
            [patientId, doctorId, dateStr, timeStr]
        );
        const mockApptId = apptResult.insertId;
        console.log(`- Created mock appointment to release, ID: ${mockApptId}`);

        // 4. Configure Doctor's autofill settings
        await pool.query(
            `INSERT INTO autofill_settings (doctor_id, enabled, offer_window_mins, min_notice_hours, max_offers_per_slot, priority_mode)
             VALUES (?, TRUE, 30, 1, 3, 'FIFO')
             ON DUPLICATE KEY UPDATE enabled = TRUE, min_notice_hours = 1`,
            [doctorId]
        );
        console.log('- Setup autofill settings for doctor to ENABLED.');

        // 5. Join patient to waitlist
        const joinRes = await waitlistService.joinWaitlist(patientId, doctorId, {
            preferredDate: dateStr,
            timePreference: 'ANY',
            maxNoticeHours: 2,
            reason: 'Verification test'
        });

        if (!joinRes.success) {
            throw new Error(`Failed to join waitlist: ${joinRes.error}`);
        }
        const waitlistId = joinRes.waitlistId;
        console.log(`- Patient joined waitlist successfully, ID: ${waitlistId}`);

        // 6. Release slot to trigger handleSlotRelease & notifications
        console.log('\nReleasing slot to trigger notifications...');
        const releaseRes = await waitlistService.handleSlotRelease(mockApptId, 'CANCELLATION');

        if (!releaseRes.success) {
            throw new Error(`handleSlotRelease failed: ${releaseRes.error || releaseRes.reason}`);
        }
        console.log('- handleSlotRelease result:', releaseRes);

        // 7. Verify notification insertion in database
        const [notifications] = await pool.query(
            `SELECT * FROM notifications 
             WHERE user_id = ? AND type = 'WAITLIST_OFFER'
             ORDER BY created_at DESC LIMIT 1`,
            [patientId]
        );

        if (notifications.length === 0) {
            throw new Error('FAILED: No waitlist offer notification was created in the database!');
        }

        const notification = notifications[0];
        console.log('\n✓ SUCCESS: Waitlist offer notification created in database!');
        console.log(`- Notification ID: ${notification.id}`);
        console.log(`- Title: ${notification.title}`);
        console.log(`- Message: ${notification.message}`);

        // 8. Clean up test records
        console.log('\nCleaning up verification records from database...');
        await pool.query('DELETE FROM notifications WHERE id = ?', [notification.id]);
        await pool.query('DELETE FROM slot_offers WHERE waitlist_id = ?', [waitlistId]);
        await pool.query('DELETE FROM waitlist WHERE id = ?', [waitlistId]);
        await pool.query('DELETE FROM slot_release_log WHERE appointment_id = ?', [mockApptId]);
        await pool.query('DELETE FROM appointments WHERE id = ?', [mockApptId]);
        console.log('✓ Cleanup complete.');

        console.log('\n=== ALL WAITLIST NOTIFICATION VERIFICATIONS PASSED ===');
        process.exit(0);
    } catch (err) {
        console.error('\n=== VERIFICATION FAILED ===');
        console.error(err);
        process.exit(1);
    }
}

runTests();
