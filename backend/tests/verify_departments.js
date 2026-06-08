const request = require('supertest');
const app = require('../src/server');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../src/config/auth');

async function runTests() {
    console.log('=== Starting Departments System Verification ===\n');
    try {
        // Generate Admin JWT token
        const adminToken = jwt.sign({ id: 9999, role: 'ADMIN' }, jwtSecret);

        // 1. Fetch public departments list
        console.log('1. Testing GET /api/departments (Public)...');
        const pubRes = await request(app)
            .get('/api/departments');

        if (pubRes.statusCode !== 200) {
            throw new Error(`Public departments endpoint failed with status ${pubRes.statusCode}: ${JSON.stringify(pubRes.body)}`);
        }

        console.log(`- Retrieved ${pubRes.body.length} departments.`);
        const deptNames = pubRes.body.map(d => d.name);
        console.log('- Seeded departments found:', deptNames);

        // Verify seeded specialties exist in the response
        const expectedDepts = ['Cardiologist', 'General Physician', 'Dermatologist', 'Neurologist', 'Pediatrician'];
        for (const exp of expectedDepts) {
            if (!deptNames.includes(exp)) {
                throw new Error(`Seeded department "${exp}" not found in public list!`);
            }
        }
        console.log('  - Seeded departments presence check: PASS');

        // 2. Fetch admin departments list
        console.log('\n2. Testing GET /api/admin/departments (Admin)...');
        const adminRes = await request(app)
            .get('/api/admin/departments')
            .set('Authorization', `Bearer ${adminToken}`);

        if (adminRes.statusCode !== 200) {
            throw new Error(`Admin departments endpoint failed with status ${adminRes.statusCode}: ${JSON.stringify(adminRes.body)}`);
        }

        console.log(`- Retrieved ${adminRes.body.length} admin department records.`);
        for (const dep of adminRes.body) {
            if (dep.doctor_count === undefined || !Array.isArray(dep.doctors)) {
                throw new Error(`Department "${dep.name}" payload is missing doctor count or doctor array!`);
            }
        }
        console.log('  - Doctor list and doctor count properties check: PASS');

        // 3. Create a new department
        const testDeptName = 'Oncology_' + Date.now();
        console.log(`\n3. Testing POST /api/admin/departments (Admin) with department: "${testDeptName}"...`);
        const createRes = await request(app)
            .post('/api/admin/departments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: testDeptName,
                description: 'Oncology department for cancer care and therapies.'
            });

        if (createRes.statusCode !== 201) {
            throw new Error(`Failed to create department. Status ${createRes.statusCode}: ${JSON.stringify(createRes.body)}`);
        }

        const newDeptId = createRes.body.id;
        console.log(`- Successfully created department with ID: ${newDeptId}`);

        // 4. Verify new department appears in public list
        console.log('\n4. Verifying new department is in the public list...');
        const pubVerifyRes = await request(app)
            .get('/api/departments');
        const updatedDeptNames = pubVerifyRes.body.map(d => d.name);
        if (!updatedDeptNames.includes(testDeptName)) {
            throw new Error(`Newly created department "${testDeptName}" was not found in the public list!`);
        }
        console.log('  - New department list check: PASS');

        // 5. Test constraint: Try to delete a department with doctors assigned
        console.log('\n5. Testing DELETE /api/admin/departments/:id error handling (assigned doctors)...');
        // Let's find an active department name that has doctors
        const occupiedDept = adminRes.body.find(d => d.doctor_count > 0);
        if (occupiedDept) {
            console.log(`- Found department "${occupiedDept.name}" with ${occupiedDept.doctor_count} doctors.`);
            const deleteOccupiedRes = await request(app)
                .delete(`/api/admin/departments/${occupiedDept.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (deleteOccupiedRes.statusCode !== 400) {
                throw new Error(`Expected status 400 when deleting occupied department, but got ${deleteOccupiedRes.statusCode}`);
            }
            if (!deleteOccupiedRes.body.message.includes('Cannot delete department')) {
                throw new Error(`Expected error message to mention 'Cannot delete department', but got: ${JSON.stringify(deleteOccupiedRes.body)}`);
            }
            console.log('  - Deletion rejection check: PASS');
        } else {
            console.log('- No department with doctors found to test occupied deletion check.');
        }

        // 6. Delete the new test department
        console.log(`\n6. Testing DELETE /api/admin/departments/${newDeptId}...`);
        const deleteRes = await request(app)
            .delete(`/api/admin/departments/${newDeptId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        if (deleteRes.statusCode !== 200) {
            throw new Error(`Failed to delete department. Status ${deleteRes.statusCode}: ${JSON.stringify(deleteRes.body)}`);
        }
        console.log('  - Deletion of test department: PASS');

        // 7. Verify it is gone from the public list
        console.log('\n7. Verifying test department is gone from the list...');
        const finalPubRes = await request(app)
            .get('/api/departments');
        const finalDeptNames = finalPubRes.body.map(d => d.name);
        if (finalDeptNames.includes(testDeptName)) {
            throw new Error(`Test department "${testDeptName}" is still present in the list after deletion!`);
        }
        console.log('  - Department deletion verification: PASS');

        console.log('\n=== ALL DEPARTMENTS SYSTEM VERIFICATIONS PASSED SUCCESSFULLY ===');
        process.exit(0);
    } catch (err) {
        console.error('\n=== VERIFICATION FAILED ===');
        console.error(err);
        process.exit(1);
    }
}

runTests();
