/**
 * Automated diagnostic script for Patient Appointment Scheduling System API.
 * This script tests key endpoints to ensure the backend is functional.
 * Uses native fetch (Node 18+).
 */

const BASE_URL = 'http://localhost:7860/api';

const endpoints = [
    { name: 'Doctors List', url: '/doctors', method: 'GET' },
    // These require authentication, so we expect 401/403 if no token
    { name: 'My Waitlist', url: '/appointments/waitlist/my', method: 'GET' },
    { name: 'Slot Offers', url: '/appointments/waitlist/offers', method: 'GET' },
    { name: 'Pending Feedback', url: '/feedback/pending', method: 'GET' },
    { name: 'Express Check-in Day', url: '/express-checkin/today', method: 'GET' },
    { name: 'Prep Overview', url: '/prep/overview', method: 'GET' },
];

async function runTests() {
    console.log('--- Starting API Endpoint Audit ---');
    let successCount = 0;
    let failCount = 0;

    for (const ep of endpoints) {
        try {
            console.log(`Testing [${ep.method}] ${ep.name}...`);
            const response = await fetch(`${BASE_URL}${ep.url}`, {
                method: ep.method,
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                console.log(`✅ ${ep.name}: Success (${response.status})`);
                successCount++;
            } else if (response.status === 401 || response.status === 403) {
                console.log(`ℹ️ ${ep.name}: Requires Auth (${response.status}) - Endpoint reachable`);
                successCount++;
            } else {
                const data = await response.json().catch(() => ({}));
                console.log(`❌ ${ep.name}: Failed with status ${response.status}`);
                console.log(`   Error: ${data.error || response.statusText}`);
                failCount++;
            }
        } catch (error) {
            console.log(`❌ ${ep.name}: Network/Timeout Error - ${error.message}`);
            failCount++;
        }
    }

    console.log('\n--- Audit Summary ---');
    console.log(`Total Endpoints: ${endpoints.length}`);
    console.log(`Passed/Reachable: ${successCount}`);
    console.log(`Failed/Error: ${failCount}`);
    
    if (failCount > 0) {
        process.exit(1);
    }
}

runTests();
