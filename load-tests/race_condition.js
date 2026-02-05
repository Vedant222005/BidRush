import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = 'http://localhost:3000/api'; 
const AUCTION_ID = 21; 

export const options = {
    scenarios: {
        precision_test: {
            executor: 'per-vu-iterations',
            vus: 10,  // 10 extremely fast users
            iterations: 5, // Each sends 5 rapid-fire bids
            maxDuration: '10s',
        },
    },
};

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

export default function (data) {
    const token = data.tokens[(__VU - 1) % data.tokens.length];
    if (!token) return;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
    };

    // 1. Get current price
    const getRes = http.get(`${BASE_URL}/auction/${AUCTION_ID}`, { headers });
    const auction = getRes.json();
    const currentBid = parseFloat((auction.data && auction.data.current_bid) || auction.current_bid || auction.starting_bid || 0);

    // 2. Bid significantly higher to avoid 400 errors (we want 201s to analyze timestamps)
    // Adding a huge random buffer ensures we aren't rejected by "stale" reads
    const myBidAmount = currentBid + 1000 + (Math.floor(Math.random() * 10000));

    const payload = JSON.stringify({ bid_amount: myBidAmount });
    const res = http.post(`${BASE_URL}/bids/create/${AUCTION_ID}`, payload, { headers });

    // 3. 🔬 ANALYZE THE TIMESTAMP
    if (res.status === 201) {
        const body = res.json();
        const dbTime = body.bid.placed_at; // Format: 2026-02-01T06:27:13.123456Z

        // Log the exact microsecond string
        console.log(`⏱️ VU ${__VU} Success | DB Time: ${dbTime}`);
    }
}