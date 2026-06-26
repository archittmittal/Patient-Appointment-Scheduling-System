require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/db');
const authConfig = require('./src/config/auth');

const BCRYPT_ROUNDS = authConfig.bcryptRounds || 10;

async function seed() {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
        console.error('❌ ERROR: Seeding is disabled in production unless ALLOW_PRODUCTION_SEED=true is set.');
        process.exit(1);
    }

    console.log('=== Starting Database Seeding ===');

    try {
        // 1. Hash password helper
        const testPassword = 'Test@1234';
        const defaultPasswordVal = 'password123';
        const testHashedPassword = await bcrypt.hash(testPassword, BCRYPT_ROUNDS);
        const defaultHashedPassword = await bcrypt.hash(defaultPasswordVal, BCRYPT_ROUNDS);

        // Define specific test accounts to be recreated
        const testEmails = ['admin@test.com', 'doctor1@test.com', 'doctor2@test.com', 'patient@test.com'];

        console.log('Cleaning up existing test user data...');
        const [existingUsers] = await db.query('SELECT id FROM users WHERE email IN (?)', [testEmails]);
        if (existingUsers.length > 0) {
            const userIds = existingUsers.map(u => u.id);
            
            // Delete in reverse dependency order
            await db.query('DELETE FROM prescriptions WHERE patient_id IN (?) OR doctor_id IN (?)', [userIds, userIds]);
            await db.query('DELETE FROM patient_vitals WHERE patient_id IN (?)', [userIds]);
            await db.query('DELETE FROM live_queue WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id IN (?) OR doctor_id IN (?))', [userIds, userIds]);
            await db.query('DELETE FROM consent_logs WHERE patient_id IN (?) OR doctor_id IN (?)', [userIds, userIds]);
            await db.query('DELETE FROM appointments WHERE patient_id IN (?) OR doctor_id IN (?)', [userIds, userIds]);
            await db.query('DELETE FROM patients WHERE id IN (?)', [userIds]);
            await db.query('DELETE FROM doctors WHERE id IN (?)', [userIds]);
            await db.query('DELETE FROM users WHERE id IN (?)', [userIds]);
        }
        console.log('✓ Cleanup complete.');

        // Helper to check and insert a user
        async function getOrCreateUser(email, passwordHash, role) {
            const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
            if (rows.length > 0) {
                return rows[0].id;
            }
            const [result] = await db.query(
                'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
                [email, passwordHash, role]
            );
            return result.insertId;
        }

        // 2. Seed Admins
        const adminId = await getOrCreateUser('admin@hospital.com', defaultHashedPassword, 'ADMIN');
        const testAdminId = await getOrCreateUser('admin@test.com', testHashedPassword, 'ADMIN');
        console.log(`✓ Admin users verified/seeded (IDs: ${adminId}, ${testAdminId})`);

        // 3. Seed Patients
        const patientsData = [
            {
                email: 'patient@example.com',
                first_name: 'John',
                last_name: 'Doe',
                dob: '1990-05-15',
                phone: '+15551234567',
                blood_group: 'O+',
                address: '123 Healing St, Apartment 4B, Healthville',
                abha_id: 'john.doe@example.abha',
                abha_number: '11-2222-3333-44'
            },
            {
                email: 'jane@example.com',
                first_name: 'Jane',
                last_name: 'Smith',
                dob: '1992-08-20',
                phone: '+15559876543',
                blood_group: 'A-',
                address: '456 Care Ave, Suite 10, Healthville',
                abha_id: 'jane.smith@example.abha',
                abha_number: '22-3333-4444-55'
            },
            {
                email: 'robert@example.com',
                first_name: 'Robert',
                last_name: 'Wilson',
                dob: '1985-11-02',
                phone: '+15552345678',
                blood_group: 'B+',
                address: '789 Wellness Blvd, Healthville',
                abha_id: 'robert.wilson@example.abha',
                abha_number: '33-4444-5555-66'
            },
            {
                email: 'patient@test.com',
                first_name: 'Test',
                last_name: 'Patient',
                dob: '1995-01-01',
                phone: '+919999999999',
                blood_group: 'AB+',
                address: '404 Test Block, Clinic Area, New Delhi',
                abha_id: 'test.patient@abha',
                abha_number: '12-3456-7890-12'
            }
        ];

        const patientMap = {};
        for (const p of patientsData) {
            const isTestUser = p.email === 'patient@test.com';
            const hashed = isTestUser ? testHashedPassword : defaultHashedPassword;
            const uid = await getOrCreateUser(p.email, hashed, 'PATIENT');
            patientMap[p.email] = uid;

            // Seed/Update patient profile
            const [exists] = await db.query('SELECT id FROM patients WHERE id = ?', [uid]);
            if (exists.length === 0) {
                await db.query(
                    'INSERT INTO patients (id, first_name, last_name, dob, phone, blood_group, address, abha_id, abha_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [uid, p.first_name, p.last_name, p.dob, p.phone, p.blood_group, p.address, p.abha_id, p.abha_number]
                );
            } else {
                await db.query(
                    'UPDATE patients SET first_name=?, last_name=?, dob=?, phone=?, blood_group=?, address=?, abha_id=?, abha_number=? WHERE id=?',
                    [p.first_name, p.last_name, p.dob, p.phone, p.blood_group, p.address, p.abha_id, p.abha_number, uid]
                );
            }
        }
        console.log(`✓ Patients verified/seeded.`);

        // 4. Seed Doctors
        const doctorsData = [
            {
                email: 'dr.sarah@hospital.com',
                first_name: 'Sarah',
                last_name: 'Jenkins',
                specialty: 'Cardiologist',
                degree: 'MBBS, MD - Cardiology',
                experience_years: 15,
                rating: 4.9,
                review_count: 128,
                about: 'Top Cardiologist with over 15 years experience.',
                location_room: 'Heart Care Pavilion, Block C',
                consultation_fee: 1500.00,
                availability: {
                    monday: ["09:00 AM", "10:00 AM", "11:00 AM"],
                    tuesday: ["09:00 AM", "10:00 AM", "11:00 AM"]
                }
            },
            {
                email: 'dr.priya@hospital.com',
                first_name: 'Priya',
                last_name: 'Sharma',
                specialty: 'Dermatologist',
                degree: 'MBBS, MD - Dermatology',
                experience_years: 10,
                rating: 4.7,
                review_count: 85,
                about: 'Expert in clinical and aesthetic dermatology.',
                location_room: 'Dermatology Suite, Room 204',
                consultation_fee: 800.00,
                availability: {
                    wednesday: ["10:00 AM", "11:00 AM", "12:00 PM"],
                    thursday: ["10:00 AM", "11:00 AM", "12:00 PM"]
                }
            },
            {
                email: 'dr.michael@hospital.com',
                first_name: 'Michael',
                last_name: 'Chen',
                specialty: 'General Physician',
                degree: 'MBBS',
                experience_years: 8,
                rating: 4.8,
                review_count: 256,
                about: 'Expert in general medicine and family healthcare.',
                location_room: 'Central Clinic, Room 102',
                consultation_fee: 500.00,
                availability: {
                    friday: ["02:00 PM", "03:00 PM", "04:00 PM"]
                }
            },
            {
                email: 'doctor1@test.com',
                first_name: 'Sarah',
                last_name: 'Jenkins',
                specialty: 'Cardiologist',
                degree: 'MBBS, MD - Cardiology',
                experience_years: 15,
                rating: 4.9,
                review_count: 128,
                about: 'Top Cardiologist with over 15 years experience.',
                location_room: 'Heart Care Pavilion, Block C',
                consultation_fee: 1500.00,
                availability: {
                    monday: ["09:00 AM", "10:00 AM", "11:00 AM"],
                    tuesday: ["09:00 AM", "10:00 AM", "11:00 AM"],
                    wednesday: ["09:00 AM", "10:00 AM", "11:00 AM"]
                }
            },
            {
                email: 'doctor2@test.com',
                first_name: 'Michael',
                last_name: 'Chen',
                specialty: 'General Physician',
                degree: 'MBBS',
                experience_years: 8,
                rating: 4.8,
                review_count: 256,
                about: 'Expert in general medicine.',
                location_room: 'Central Clinic, Room 102',
                consultation_fee: 500.00,
                availability: {
                    wednesday: ["02:00 PM", "03:00 PM", "04:00 PM"],
                    thursday: ["02:00 PM", "03:00 PM", "04:00 PM"],
                    friday: ["02:00 PM", "03:00 PM", "04:00 PM"]
                }
            }
        ];

        const doctorMap = {};
        for (const d of doctorsData) {
            const isTestUser = d.email.endsWith('@test.com');
            const hashed = isTestUser ? testHashedPassword : defaultHashedPassword;
            const uid = await getOrCreateUser(d.email, hashed, 'DOCTOR');
            doctorMap[d.email] = uid;

            const [exists] = await db.query('SELECT id FROM doctors WHERE id = ?', [uid]);
            const imgUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.first_name + '+' + d.last_name)}&background=random`;
            const availabilityStr = JSON.stringify(d.availability);
            
            if (exists.length === 0) {
                await db.query(
                    `INSERT INTO doctors 
                        (id, first_name, last_name, specialty, degree, experience_years, rating, review_count, about, location_room, image_url, availability, consultation_fee) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uid, d.first_name, d.last_name, d.specialty, d.degree, d.experience_years, d.rating, d.review_count, d.about, d.location_room, imgUrl, availabilityStr, d.consultation_fee]
                );
            } else {
                await db.query(
                    `UPDATE doctors SET 
                        first_name=?, last_name=?, specialty=?, degree=?, experience_years=?, rating=?, review_count=?, about=?, location_room=?, image_url=?, availability=?, consultation_fee=?
                     WHERE id=?`,
                    [d.first_name, d.last_name, d.specialty, d.degree, d.experience_years, d.rating, d.review_count, d.about, d.location_room, imgUrl, availabilityStr, d.consultation_fee, uid]
                );
            }
        }
        console.log(`✓ Doctors verified/seeded.`);

        // 5. Seed Appointments for both demo and test users
        const appointments = [
            {
                patient_email: 'patient@example.com',
                doctor_email: 'dr.sarah@hospital.com',
                offset_days: 0,
                time_slot: '10:00 AM',
                symptoms: 'Chest pain and tightness',
                status: 'CONFIRMED'
            },
            {
                patient_email: 'patient@example.com',
                doctor_email: 'dr.michael@hospital.com',
                offset_days: 2,
                time_slot: '02:30 PM',
                symptoms: 'Fever and cough for 3 days',
                status: 'PENDING'
            },
            {
                patient_email: 'jane@example.com',
                doctor_email: 'dr.priya@hospital.com',
                offset_days: 0,
                time_slot: '11:00 AM',
                symptoms: 'Skin rash and severe itching',
                status: 'CONFIRMED'
            },
            {
                patient_email: 'robert@example.com',
                doctor_email: 'dr.sarah@hospital.com',
                offset_days: -1,
                time_slot: '09:00 AM',
                symptoms: 'Routine cardiac follow-up',
                status: 'COMPLETED',
                diagnosis: 'Stable angina',
                notes: 'Recovery is on track. Keep current prescription.',
                prescription: 'Aspirin 81mg daily',
                follow_up_offset: 30
            },
            {
                patient_email: 'jane@example.com',
                doctor_email: 'dr.michael@hospital.com',
                offset_days: 1,
                time_slot: '10:30 AM',
                symptoms: 'Mild knee swelling after run',
                status: 'CONFIRMED'
            },
            {
                patient_email: 'robert@example.com',
                doctor_email: 'dr.priya@hospital.com',
                offset_days: 3,
                time_slot: '04:00 PM',
                symptoms: 'Annual skin mole inspection',
                status: 'PENDING'
            },
            {
                patient_email: 'patient@example.com',
                doctor_email: 'dr.priya@hospital.com',
                offset_days: -1,
                time_slot: '01:00 PM',
                symptoms: 'Sunburn on shoulders',
                status: 'COMPLETED',
                diagnosis: 'First-degree sunburn',
                notes: 'Avoid direct sun. Hydrate.',
                prescription: 'Aloe Vera gel apply twice daily'
            },
            {
                patient_email: 'jane@example.com',
                doctor_email: 'dr.sarah@hospital.com',
                offset_days: 0,
                time_slot: '03:00 PM',
                symptoms: 'Mild heart palpitations',
                status: 'PENDING'
            },
            {
                patient_email: 'robert@example.com',
                doctor_email: 'dr.michael@hospital.com',
                offset_days: -2,
                time_slot: '11:30 AM',
                symptoms: 'Sprained left ankle',
                status: 'COMPLETED',
                diagnosis: 'Grade 1 lateral ankle sprain',
                notes: 'RICE protocol. Elevate leg.',
                prescription: 'Ibuprofen 400mg as needed for pain'
            },
            {
                patient_email: 'patient@example.com',
                doctor_email: 'dr.sarah@hospital.com',
                offset_days: 4,
                time_slot: '09:30 AM',
                symptoms: 'Cardiac stress test follow-up',
                status: 'PENDING'
            },
            // Test user specific appointments
            {
                patient_email: 'patient@test.com',
                doctor_email: 'doctor1@test.com',
                offset_days: -2,
                time_slot: '10:00 AM',
                symptoms: 'Severe headache and high blood pressure',
                status: 'COMPLETED',
                diagnosis: 'Essential Hypertension',
                notes: 'Patient exhibits elevated blood pressure. Advised low sodium diet.',
                prescription: 'Lisinopril 10mg daily',
                follow_up_offset: 14,
                is_test_appointment: true
            },
            {
                patient_email: 'patient@test.com',
                doctor_email: 'doctor2@test.com',
                offset_days: 2,
                time_slot: '11:00 AM',
                symptoms: 'Follow-up on blood pressure and general health check',
                status: 'CONFIRMED',
                is_test_appointment: true
            }
        ];

        // Seeding appointments
        for (const a of appointments) {
            const patientId = patientMap[a.patient_email];
            const doctorId = doctorMap[a.doctor_email];

            if (!patientId || !doctorId) continue;

            // For non-test appointments, only insert if database is relatively empty
            if (!a.is_test_appointment) {
                const [exists] = await db.query(
                    'SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ? AND time_slot = ? AND status = ?',
                    [patientId, doctorId, a.time_slot, a.status]
                );
                if (exists.length > 0) continue;
            }

            const apptDate = new Date();
            apptDate.setDate(apptDate.getDate() + a.offset_days);
            const formattedDate = apptDate.toISOString().slice(0, 10);

            let followUpDate = null;
            if (a.follow_up_offset) {
                const fu = new Date();
                fu.setDate(fu.getDate() + a.follow_up_offset);
                followUpDate = fu.toISOString().slice(0, 10);
            }

            const [result] = await db.query(
                `INSERT IGNORE INTO appointments 
                (patient_id, doctor_id, appointment_date, time_slot, symptoms, status, diagnosis, notes, prescription, follow_up_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    patientId,
                    doctorId,
                    formattedDate,
                    a.time_slot,
                    a.symptoms,
                    a.status,
                    a.diagnosis || null,
                    a.notes || null,
                    a.prescription || null,
                    followUpDate
                ]
            );

            // If it is our completed test appointment, seed its structured vitals and prescriptions
            if (a.is_test_appointment && a.status === 'COMPLETED' && result.insertId) {
                const appointmentId = result.insertId;

                // Seed Patient Vitals
                const vitalsRecordedAt = new Date();
                vitalsRecordedAt.setDate(vitalsRecordedAt.getDate() - 2);
                
                await db.query(
                    `INSERT INTO patient_vitals 
                        (patient_id, weight_kg, height_cm, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature_c, spo2, recorded_by, recorded_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [patientId, 78.5, 180.0, 130, 85, 76, 37.0, 99, doctorId, vitalsRecordedAt]
                );

                // Seed Prescription
                await db.query(
                    `INSERT INTO prescriptions
                        (doctor_id, patient_id, appointment_id, medications, instructions, dosage, frequency, duration_days, refills_remaining, is_active, date_prescribed)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())`,
                    [doctorId, patientId, appointmentId, 'Lisinopril 10mg', 'Take once daily in the morning', '10mg', 'once daily', 30, 3]
                );
            }
        }
        console.log('✓ Appointments, structured vitals and prescriptions seeded.');

        // 6. Seed Insurance Providers (idempotent)
        const providers = [
            { name: 'BlueCross BlueShield', email: 'support@bcbs.com', endpoint: 'https://api.bcbs.com/v1/verify', env: 'BCBS_API_KEY' },
            { name: 'Aetna', email: 'provider@aetna.com', endpoint: 'https://api.aetna.com/v1/eligibility', env: 'AETNA_API_KEY' },
            { name: 'Cigna', email: 'claims@cigna.com', endpoint: 'https://api.cigna.com/v2/check', env: 'CIGNA_API_KEY' },
            { name: 'UnitedHealthcare', email: 'verify@uhc.com', endpoint: 'https://api.uhc.com/v1/status', env: 'UHC_API_KEY' }
        ];

        try {
            await db.query('SELECT 1 FROM insurance_providers LIMIT 1');
            for (const p of providers) {
                const [exists] = await db.query('SELECT id FROM insurance_providers WHERE name = ?', [p.name]);
                if (exists.length === 0) {
                    await db.query(
                        'INSERT INTO insurance_providers (name, contact_email, api_endpoint, api_key_env_var) VALUES (?, ?, ?, ?)',
                        [p.name, p.email, p.endpoint, p.env]
                    );
                }
            }
            console.log('✓ Insurance providers verified/seeded.');
        } catch (e) {
            console.log('ℹ Insurance providers table not yet initialized. Skipping insurance seeding.');
        }

        // Print beautiful summary
        const [usersFinal] = await db.query('SELECT COUNT(*) AS total FROM users');
        const [patientsFinal] = await db.query('SELECT COUNT(*) AS total FROM patients');
        const [doctorsFinal] = await db.query('SELECT COUNT(*) AS total FROM doctors');
        const [apptsFinal] = await db.query('SELECT COUNT(*) AS total FROM appointments');
        const [vitalsFinal] = await db.query('SELECT COUNT(*) AS total FROM patient_vitals');
        const [prescriptionsFinal] = await db.query('SELECT COUNT(*) AS total FROM prescriptions');

        console.log('\n================ SEEDING COMPLETE ================');
        console.table([
            { Table: 'Users', Count: usersFinal[0].total },
            { Table: 'Patients', Count: patientsFinal[0].total },
            { Table: 'Doctors', Count: doctorsFinal[0].total },
            { Table: 'Appointments', Count: apptsFinal[0].total },
            { Table: 'Patient Vitals', Count: vitalsFinal[0].total },
            { Table: 'Prescriptions', Count: prescriptionsFinal[0].total }
        ]);
        console.log('==================================================\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed with error:', error);
        process.exit(1);
    }
}

seed();
