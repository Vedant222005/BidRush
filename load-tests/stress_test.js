import http from 'k6/http';
import { check, sleep } from 'k6';

// --- CONFIGURATION ---
const BASE_URL = 'http://localhost:3000/api'; 
const AUCTION_ID = 21; 

export const options = {
    // Key difference: We use "stages" to ramp up load
    stages: [
        { duration: '30s', target: 50 },  // 1. Warm up: Go from 0 to 50 users
        { duration: '1m', target: 200 },  // 2. Ramp up: Go to 200 users (High Load)
        { duration: '30s', target: 0 },   // 3. Cool down: Go back to 0
    ],
};

// --- SETUP: LOGIN (Same as before) ---
export function setup() {
    const users = [
        { email: 'test3@gmail.com', password: '123456' }, 
        { email: 'test2@gmail.com', password: '123456' }
    ];
    const tokens = [];

    users.forEach((u) => {
        const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify(u), {
            headers: { 'Content-Type': 'application/json' },
        });
        if (res.status === 200) {
            const body = res.json();
            let token = body.token || body.accessToken || (body.data && body.data.token);
            if (!token && res.cookies.token) token = res.cookies.token[0].value;
            if (token) tokens.push(token);
        }
    });
    return { tokens }; 
}

// --- VU LOGIC ---
export default function (data) {
    const token = data.tokens[(__VU - 1) % data.tokens.length];
    if (!token) return;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
    };

    // 1. Fetch Current Price
    const getRes = http.get(`${BASE_URL}/auction/${AUCTION_ID}`, { headers });
    
    // Safety check: If GET fails, stop here (Database might be dead)
    if (getRes.status !== 200) {
        console.log(`❌ READ FAILED: ${getRes.status}`);
        return; 
    }

    const auction = getRes.json();
    const currentBid = parseFloat((auction.data && auction.data.current_bid) || auction.current_bid || 0);

    // 2. Calculate Bid (Random +100 to +5000)
    const myBidAmount = currentBid + Math.floor(Math.random() * 4900) + 100;

    // 3. Place Bid
    const payload = JSON.stringify({ bid_amount: myBidAmount });
    const res = http.post(`${BASE_URL}/bids/create/${AUCTION_ID}`, payload, { headers });

    // 4. Check for Stability
    // We accept 201 (Success) and 400 (Valid Logic Rejection)
    // We do NOT want 500, 502, 503, or 504 (Server Failure)
    check(res, {
        'System is stable (Not 5xx)': (r) => r.status < 500,
        'Response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Important: Wait 1 second before next bid to simulate "thinking time"
    // Without this, 200 users = DDoS attack, not realistic traffic
    sleep(1); 
}