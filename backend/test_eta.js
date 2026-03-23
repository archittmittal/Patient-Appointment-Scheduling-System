const db = require('./src/config/db');
const { calculateQueueWaitTime } = require('./src/services/durationPrediction');

async function test() {
    try {
        console.log('--- Testing Dynamic ETA ---');
        
        // Let's check status for appointment 13 (currently in queue at position 5, WAITING)
        const appointmentId = 13;
        
        const firstCheck = await calculateQueueWaitTime(appointmentId);
        console.log('First Check (Now):', firstCheck.estimatedWait, 'minutes');
        
        console.log('Waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const secondCheck = await calculateQueueWaitTime(appointmentId);
        console.log('Second Check (10s later):', secondCheck.estimatedWait, 'minutes');
        
        if (secondCheck.estimatedWait <= firstCheck.estimatedWait) {
            console.log('✅ Success: ETA is decrementing or stable (it might stay same due to Math.floor/round)');
        } else {
            console.log('❌ Failure: ETA increased?');
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
