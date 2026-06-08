const request = require('supertest');
const app = require('../src/server');
const db = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config/auth');

async function runTests() {
    console.log('=== Starting Symptom Checker Verification ===\n');
    try {
        // 1. Fetch a valid patient ID
        const [patients] = await db.query('SELECT id FROM patients LIMIT 1');
        if (patients.length === 0) {
            throw new Error('No patients found in the database. Please seed the database first.');
        }
        const patientId = patients[0].id;
        console.log(`Using patient ID: ${patientId} for testing.`);

        // 2. Generate tokens
        const patientToken = jwt.sign({ id: patientId, role: 'PATIENT' }, jwtSecret);
        const adminToken = jwt.sign({ id: 9999, role: 'ADMIN' }, jwtSecret);

        // 3. Define Symptom checker test cases
        const testRunId = Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const rawTestCases = [
            {
                symptoms: "my chest hurts, severe tightness, palpitations, and racing pulse",
                expectedSpecialty: "Cardiologist"
            },
            {
                symptoms: "itchy red skin rash with acne and mole dry skin",
                expectedSpecialty: "Dermatologist"
            },
            {
                symptoms: "bad fever and cold symptoms along with cough and headache",
                expectedSpecialty: "General Physician"
            },
            {
                symptoms: "random text that matches nothing",
                expectedSpecialty: "General Physician" // should fallback to General Physician
            }
        ];
        const testCases = rawTestCases.map(tc => ({
            ...tc,
            symptoms: `${tc.symptoms}\n[symptom_checker_test_${testRunId}]`
        }));

        // 4. Run POST /api/symptom-checker/analyze tests
        for (const tc of testCases) {
            console.log(`\nTesting symptoms: "${tc.symptoms}"`);
            const res = await request(app)
                .post('/api/symptom-checker/analyze')
                .set('Authorization', `Bearer ${patientToken}`)
                .send({ symptoms: tc.symptoms });

            if (res.statusCode !== 200) {
                throw new Error(`Analyze endpoint failed with status ${res.statusCode}: ${JSON.stringify(res.body)}`);
            }

            const { mappedSpecialty, explanation, suggestedDoctors } = res.body;
            console.log(`- Mapped Specialty: ${mappedSpecialty} (Expected: ${tc.expectedSpecialty})`);
            console.log(`- Explanation: ${explanation}`);
            console.log(`- Recommended Doctors count: ${suggestedDoctors.length}`);

            if (mappedSpecialty !== tc.expectedSpecialty) {
                throw new Error(`Mismatch! Expected ${tc.expectedSpecialty} but got ${mappedSpecialty}`);
            }

            if (suggestedDoctors.length > 0) {
                console.log(`  - First recommended doctor: ${suggestedDoctors[0].name} (Wait: ${suggestedDoctors[0].estimatedWaitMins}m, Fee: ₹${suggestedDoctors[0].consultationFee})`);
                // Assert sorted by wait time
                for (let i = 0; i < suggestedDoctors.length - 1; i++) {
                    if (suggestedDoctors[i].estimatedWaitMins > suggestedDoctors[i+1].estimatedWaitMins) {
                        throw new Error('Doctors are not sorted by estimatedWaitMins ascending!');
                    }
                }
                console.log('  - Sorted order check: PASS');
            }
        }

        // 5. Test GET /api/symptom-checker/admin-stats
        console.log('\nTesting GET /api/symptom-checker/admin-stats (as ADMIN)...');
        const adminRes = await request(app)
            .get('/api/symptom-checker/admin-stats')
            .set('Authorization', `Bearer ${adminToken}`);

        if (adminRes.statusCode !== 200) {
            throw new Error(`Admin stats endpoint failed with status ${adminRes.statusCode}: ${JSON.stringify(adminRes.body)}`);
        }

        const { specialtyDistribution, recentLogs, topKeywords } = adminRes.body;
        console.log(`- Specialty Distribution count: ${specialtyDistribution.length}`);
        console.log(`- Recent Logs count: ${recentLogs.length}`);
        console.log(`- Top Keywords count: ${topKeywords.length}`);

        if (!Array.isArray(specialtyDistribution) || !Array.isArray(recentLogs) || !Array.isArray(topKeywords)) {
            throw new Error('Admin stats keys are not returning correct arrays!');
        }

        // Verify keywords frequencies were calculated
        if (topKeywords.length > 0) {
            console.log('- Top keywords sample:', topKeywords.slice(0, 3));
        }

        // Clean up the created logs in database
        console.log('\nCleaning up verification search logs from database...');
        await db.query(
            'DELETE FROM symptom_checker_logs WHERE patient_id = ? AND symptoms_text LIKE ?',
            [patientId, `%\n[symptom_checker_test_${testRunId}]`]
        );
        console.log('Clean up complete.');

        console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
        process.exit(0);
    } catch (err) {
        console.error('\n=== VERIFICATION FAILED ===');
        console.error(err);
        process.exit(1);
    }
}

runTests();
