const axios = require('axios');

const BASE_URL = 'http://localhost:7860/api';

async function verifySecurity() {
    console.log('--- Security Verification Started ---');

    try {
        // 1. Verify Helmet Headers
        console.log('1. Checking Security Headers (Helmet)...');
        const healthRes = await axios.get(`${BASE_URL}/health`);
        const headers = healthRes.headers;
        
        const expectedHeaders = [
            'x-dns-prefetch-control',
            'x-frame-options',
            'x-content-type-options',
            'strict-transport-security'
        ];
        
        let helmetPassed = true;
        expectedHeaders.forEach(h => {
            if (headers[h]) {
                console.log(`   [PASS] ${h}: ${headers[h]}`);
            } else {
                console.log(`   [FAIL] ${h} missing`);
                helmetPassed = false;
            }
        });

        // 2. Verify CORS
        console.log('2. Checking CORS Whitelist...');
        try {
            const corsRes = await axios.get(`${BASE_URL}/health`, {
                headers: { 'Origin': 'http://evil.com' }
            });
            // axios doesn't fail on CORS unless it's a browser, but we can check headers
            if (corsRes.headers['access-control-allow-origin'] === 'http://evil.com') {
                console.log('   [FAIL] CORS allows evil.com');
            } else {
                console.log('   [PASS] CORS rejected evil.com (or didn\'t reflect it)');
            }
        } catch (e) {
            console.log('   [PASS] CORS request failed as expected');
        }

        // 3. Verify Rate Limiting
        console.log('3. Checking Rate Limiting (General)...');
        console.log('   Sending 105 requests to /health...');
        let rateLimited = false;
        for (let i = 0; i < 105; i++) {
            try {
                const res = await axios.get(`${BASE_URL}/health`);
                if (res.status === 429) {
                    rateLimited = true;
                    console.log(`   [PASS] Rate limited at request ${i}`);
                    break;
                }
            } catch (error) {
                if (error.response && error.response.status === 429) {
                    rateLimited = true;
                    console.log(`   [PASS] Rate limited at request ${i}`);
                    break;
                }
            }
        }
        if (!rateLimited) console.log('   [FAIL] Not rate limited after 100 requests');

    } catch (error) {
        console.error('Verification failed due to error:', error.message);
    }
}

verifySecurity();
