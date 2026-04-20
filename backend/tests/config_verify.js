const { exec } = require('child_process');
const path = require('path');

console.log('--- Config Validation Verification ---');

// Test 1: Missing JWT_SECRET
console.log('1. Testing Missing JWT_SECRET...');
const envMissing = { ...process.env, JWT_SECRET: '' };
const proc = exec('node src/config/index.js', { 
    cwd: path.join(__dirname, '../'),
    env: envMissing 
}, (error, stdout, stderr) => {
    if (stderr.includes('JWT_SECRET" is not allowed to be empty')) {
        console.log('   [PASS] Successfully caught empty JWT_SECRET');
    } else if (stderr.includes('JWT_SECRET" is required')) {
        console.log('   [PASS] Successfully caught missing JWT_SECRET');
    } else {
        console.log('   [FAIL] Did not catch missing JWT_SECRET');
        console.log('   Stderr:', stderr);
    }

    // Test 2: Valid Config
    console.log('2. Testing Valid Config...');
    exec('node src/config/index.js', { 
        cwd: path.join(__dirname, '../')
    }, (error, stdout, stderr) => {
        if (!stderr) {
            console.log('   [PASS] Valid config loaded successfully');
        } else {
            console.log('   [FAIL] Valid config failed to load');
            console.log('   Stderr:', stderr);
        }
    });
});
