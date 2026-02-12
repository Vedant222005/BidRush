import http from 'k6/http';
import { Counter } from 'k6/metrics';

// ==============================================================================
// 1. CONFIGURATION
// ==============================================================================
const BASE_URL = 'http://localhost:3000/api'; 
const AUCTION_ID = 28; 
const FIXED_BID_AMOUNT = 2000; // Starting bid to test

const successfulBids = new Counter('successful_bids');
const failedBids = new Counter('failed_bids');

export const options = {
    scenarios: {
        atomic_race_condition: {
            executor: 'constant-arrival-rate',
            rate: 500,               // Total 500 bids
            timeUnit: '1s',          // Start them all within 1 second
            duration: '1s',          // Total test length
            preAllocatedVUs: 500,    // Prepare all 500 users in memory
            maxVUs: 1000,
        },
    },
};

// ==============================================================================
// 2. SETUP (Pre-login all users)
// ==============================================================================
export function setup() {
    const tokens = [];
    console.log(`🔑 Logging in 500 users...`);

    for (let i = 1; i <= 500; i++) {
        const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
            email: `ved${i}@example.com`,
            password: '123456'
        }), { headers: { 'Content-Type': 'application/json' } });

        if (res.status === 200 || res.status === 201) {
            let token = res.cookies.accessToken ? res.cookies.accessToken[0].value : res.json().token;
            if (token) tokens.push(token);
        }
    }
    console.log(`✅ ${tokens.length} users ready for the race.`);
    return { tokens };
}

// ==============================================================================
// 3. THE ATOMIC HIT
// ==============================================================================
export default function (data) {
    // Each request gets its own unique token from the setup data
    const token = data.tokens[Math.floor(Math.random() * data.tokens.length)];

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Cookie': `accessToken=${token}`
        },
    };

    const payload = JSON.stringify({ bid_amount: FIXED_BID_AMOUNT });
    
    // The actual "Hammer" hit
    const res = http.post(`${BASE_URL}/bids/create/${AUCTION_ID}`, payload, params);

    // ==============================================================================
   // ==============================================================================
    // 4. ANALYSIS 
    // ==============================================================================
    if (res.status === 201 || res.status === 200) {
        successfulBids.add(1);
        // Force log the winner
        console.log(`🏆 [DEBUG] WINNER FOUND! User: ved${__VU} | Status: ${res.status}`);
    } else {
        failedBids.add(1);
        
        // Print the reason for EVERY failure until we find the problem
        // Once you find the reason, you can add back the "if (failedBids.value <= 10)" check
        console.log(`❌ [DEBUG] FAILED (VU ${__VU}): Status ${res.status} | Body: ${res.body}`);
        
        if (res.status === 0) {
            console.error(`🚨 [DEBUG] NETWORK ERROR: Check if your server crashed!`);
        }
    }
}