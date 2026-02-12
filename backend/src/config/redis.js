const Redis = require('ioredis');

// Track Redis state
let wasDown = false;
const MAX_REBUILD_ATTEMPTS = 3;

// Create Redis client
const redis = new Redis({
    host: 'localhost',
    port: 6379,
    // password: 'your_password', // If Redis has a password
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: true
});

// Rebuild function with retry
const attemptRebuild = async (attempt = 1) => {
    try {
        console.log(`🔄 Rebuild attempt ${attempt}/${MAX_REBUILD_ATTEMPTS}...`);
        const { performRecovery } = require('../cache/auctioncache/redisRebuilt');
        await performRecovery();
        console.log('🎉 Redis cache rebuilt successfully!');
    } catch (err) {
        console.error(`❌ Rebuild attempt ${attempt} failed:`, err.message);

        if (attempt < MAX_REBUILD_ATTEMPTS) {
            console.log(`⏳ Retrying in 5 seconds...`);
            setTimeout(() => attemptRebuild(attempt + 1), 5000);
        } else {
            console.error('🚨 All rebuild attempts failed! Manual intervention may be needed.');
        }
    }
};

// Event handlers
redis.on('connect', async () => {
    console.log('✅ Redis connected successfully');

    // If Redis was down and is now back, trigger recovery
    if (wasDown) {
        console.log('🔄 Redis recovered! Starting cache rebuild...');
        wasDown = false;

        // Delay recovery to ensure stable connection
        setTimeout(() => attemptRebuild(1), 2000);
    }
});

redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
    wasDown = true;
});

redis.on('close', () => {
    console.warn('⚠️ Redis connection closed');
    wasDown = true;
});

module.exports = redis;
