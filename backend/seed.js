const bcrypt = require('bcryptjs');
const db = require('./src/config/db');

const BCRYPT_ROUNDS = 10;

async function seed() {
    console.log('=== Starting Database Seeding ===');

    try {
        // 1. Hash password helper
        const hashedPassword = await bcrypt.hash('password123', BCRYPT_ROUNDS);
        const adminPassword = await bcrypt.hash('admin123', BCRYPT_ROUNDS);

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

        // 2. Seed Admin
        const adminId = await getOrCreateUser('admin@hospital.com', adminPassword, 'ADMIN');
        console.log(`✓ Admin user verified/seeded (ID: ${adminId})`);

        // 3. Seed Patients
        const patientsData = [
            {
                email: 'patient@example.com',
                first_name: 'John',
                last_name: 'Doe',
                dob: '1990-05-15',
                phone: '+15551234567',
                blood_group: 'O+',
                address: '123 Healing St, Apartment 4B, Healthville'
            },
            {
                email: 'jane@example.com',
                first_name: 'Jane',
                last_name: 'Smith',
                dob: '1992-08-20',
                phone: '+15559876543',
                blood_group: 'A-',
                address: '456 Care Ave, Suite 10, Healthville'
            },
            {
                email: 'robert@example.com',
                first_name: 'Robert',
                last_name: 'Wilson',
                dob: '1985-11-02',
                phone: '+15552345678',
                blood_group: 'B+',
                address: '789 Wellness Blvd, Healthville'
            }
        ];

        const patientIds = [];
        for (const p of patientsData) {
            const uid = await getOrCreateUser(p.email, hashedPassword, 'PATIENT');
            patientIds.push(uid);

            // Seed/Update patient profile
            const [exists] = await db.query('SELECT id FROM patients WHERE id = ?', [uid]);
            if (exists.length === 0) {
                await db.query(
                    'INSERT INTO patients (id, first_name, last_name, dob, phone, blood_group, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [uid, p.first_name, p.last_name, p.dob, p.phone, p.blood_group, p.address]
                );
            }
        }
        console.log(`✓ ${patientIds.length} patients verified/seeded.`);

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
                location_room: 'Heart Care Pavilion, Block C'
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
                location_room: 'Dermatology Suite, Room 204'
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
                location_room: 'Central Clinic, Room 102'
            }
        ];

        const doctorIds = [];
        for (const d of doctorsData) {
            const uid = await getOrCreateUser(d.email, hashedPassword, 'DOCTOR');
            doctorIds.push(uid);

            const [exists] = await db.query('SELECT id FROM doctors WHERE id = ?', [uid]);
            const imgUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.first_name + '+' + d.last_name)}&background=random`;
            if (exists.length === 0) {
                await db.query(
                    'INSERT INTO doctors (id, first_name, last_name, specialty, degree, experience_years, rating, review_count, about, location_room, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [uid, d.first_name, d.last_name, d.specialty, d.degree, d.experience_years, d.rating, d.review_count, d.about, d.location_room, imgUrl]
                );
            }
        }
        console.log(`✓ ${doctorIds.length} doctors verified/seeded.`);

        // 5. Seed Appointments (Clean Slate / Idempotent insert of 10 appointments)
        const [apptsCount] = await db.query('SELECT COUNT(*) AS total FROM appointments');
        if (apptsCount[0].total < 5) {
            // Seed 10 appointments
            const appointments = [
                {
                    patient_id: patientIds[0], // John Doe
                    doctor_id: doctorIds[0],  // Sarah Jenkins
                    offset_days: 0,
                    time_slot: '10:00 AM',
                    symptoms: 'Chest pain and tightness',
                    status: 'CONFIRMED'
                },
                {
                    patient_id: patientIds[0], // John Doe
                    doctor_id: doctorIds[2],  // Michael Chen
                    offset_days: 2,
                    time_slot: '02:30 PM',
                    symptoms: 'Fever and cough for 3 days',
                    status: 'PENDING'
                },
                {
                    patient_id: patientIds[1], // Jane Smith
                    doctor_id: doctorIds[1],  // Priya Sharma
                    offset_days: 0,
                    time_slot: '11:00 AM',
                    symptoms: 'Skin rash and severe itching',
                    status: 'CONFIRMED'
                },
                {
                    patient_id: patientIds[2], // Robert Wilson
                    doctor_id: doctorIds[0],  // Sarah Jenkins
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
                    patient_id: patientIds[1], // Jane Smith
                    doctor_id: doctorIds[2],  // Michael Chen
                    offset_days: 1,
                    time_slot: '10:30 AM',
                    symptoms: 'Mild knee swelling after run',
                    status: 'CONFIRMED'
                },
                {
                    patient_id: patientIds[2], // Robert Wilson
                    doctor_id: doctorIds[1],  // Priya Sharma
                    offset_days: 3,
                    time_slot: '04:00 PM',
                    symptoms: 'Annual skin mole inspection',
                    status: 'PENDING'
                },
                {
                    patient_id: patientIds[0], // John Doe
                    doctor_id: doctorIds[1],  // Priya Sharma
                    offset_days: -1,
                    time_slot: '01:00 PM',
                    symptoms: 'Sunburn on shoulders',
                    status: 'COMPLETED',
                    diagnosis: 'First-degree sunburn',
                    notes: 'Avoid direct sun. Hydrate.',
                    prescription: 'Aloe Vera gel apply twice daily'
                },
                {
                    patient_id: patientIds[1], // Jane Smith
                    doctor_id: doctorIds[0],  // Sarah Jenkins
                    offset_days: 0,
                    time_slot: '03:00 PM',
                    symptoms: 'Mild heart palpitations',
                    status: 'PENDING'
                },
                {
                    patient_id: patientIds[2], // Robert Wilson
                    doctor_id: doctorIds[2],  // Michael Chen
                    offset_days: -2,
                    time_slot: '11:30 AM',
                    symptoms: 'Sprained left ankle',
                    status: 'COMPLETED',
                    diagnosis: 'Grade 1 lateral ankle sprain',
                    notes: 'RICE protocol. Elevate leg.',
                    prescription: 'Ibuprofen 400mg as needed for pain'
                },
                {
                    patient_id: patientIds[0], // John Doe
                    doctor_id: doctorIds[0],  // Sarah Jenkins
                    offset_days: 4,
                    time_slot: '09:30 AM',
                    symptoms: 'Cardiac stress test follow-up',
                    status: 'PENDING'
                }
            ];

            for (const a of appointments) {
                const apptDate = new Date();
                apptDate.setDate(apptDate.getDate() + a.offset_days);
                const formattedDate = apptDate.toISOString().slice(0, 10);

                let followUpDate = null;
                if (a.follow_up_offset) {
                    const fu = new Date();
                    fu.setDate(fu.getDate() + a.follow_up_offset);
                    followUpDate = fu.toISOString().slice(0, 10);
                }

                await db.query(
                    `INSERT INTO appointments 
                    (patient_id, doctor_id, appointment_date, time_slot, symptoms, status, diagnosis, notes, prescription, follow_up_date) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        a.patient_id,
                        a.doctor_id,
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
            }
            console.log('✓ 10 demo appointments seeded.');
        } else {
            console.log('✓ Appointments table already has data. Skipping appointment seeding.');
        }

        // 6. Seed Insurance Providers (idempotent)
        const providers = [
            { name: 'BlueCross BlueShield', email: 'support@bcbs.com', endpoint: 'https://api.bcbs.com/v1/verify', env: 'BCBS_API_KEY' },
            { name: 'Aetna', email: 'provider@aetna.com', endpoint: 'https://api.aetna.com/v1/eligibility', env: 'AETNA_API_KEY' },
            { name: 'Cigna', email: 'claims@cigna.com', endpoint: 'https://api.cigna.com/v2/check', env: 'CIGNA_API_KEY' },
            { name: 'UnitedHealthcare', email: 'verify@uhc.com', endpoint: 'https://api.uhc.com/v1/status', env: 'UHC_API_KEY' }
        ];

        // Check if insurance_providers table exists
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
            console.log('✓ Insurance providers seeded.');
        } catch (e) {
            console.log('ℹ Insurance providers table not yet initialized. Skipping insurance seeding.');
        }

        // 7. Print beautiful summary
        const [usersFinal] = await db.query('SELECT COUNT(*) AS total FROM users');
        const [patientsFinal] = await db.query('SELECT COUNT(*) AS total FROM patients');
        const [doctorsFinal] = await db.query('SELECT COUNT(*) AS total FROM doctors');
        const [apptsFinal] = await db.query('SELECT COUNT(*) AS total FROM appointments');

        console.log('\n================ SEEDING COMPLETE ================');
        console.table([
            { Table: 'Users', Count: usersFinal[0].total },
            { Table: 'Patients', Count: patientsFinal[0].total },
            { Table: 'Doctors', Count: doctorsFinal[0].total },
            { Table: 'Appointments', Count: apptsFinal[0].total }
        ]);
        console.log('==================================================\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed with error:', error);
        process.exit(1);
    }
}

seed();
