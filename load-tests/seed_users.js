const axios = require('axios');

// ⚠️ CHECK YOUR URL: Based on your code snippet, this seems to be the path.
// If your app has a global prefix like '/api', add it here.
const REGISTER_URL = 'http://localhost:3000/api/auth/register'; 

const TOTAL_USERS = 500;
const PASSWORD = '123456';

async function seedUsers() {
    console.log(`🚀 Starting registration of ${TOTAL_USERS} users...`);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 1; i <= TOTAL_USERS; i++) {
        const user = {
            username: `ved${i}`,
            email: `ved${i}@example.com`, // Unique email
            password: PASSWORD,
            full_name: `Ved User ${i}`
        };

        try {
            // Send POST request
            await axios.post(REGISTER_URL, user);
            
            // Log progress (overwrite same line to keep console clean)
            process.stdout.write(`✅ Registered: ${user.username} (${i}/${TOTAL_USERS})\r`);
            successCount++;
        } catch (error) {
            // Log failure details
            const errMsg = error.response?.data?.message || error.message;
            console.log(`\n❌ Failed to register ${user.username}: ${errMsg}`);
            failCount++;
        }
    }

    console.log('\n\n✨ SEEDING COMPLETE ✨');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed:  ${failCount}`);
}

seedUsers();