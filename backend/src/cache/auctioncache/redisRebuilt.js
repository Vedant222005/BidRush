// src/utils/recovery.js
const { getChannel, QUEUES } = require('../../config/rabbitmq');
const con = require('../../config/db');
const redis = require('../../config/redis');

/**
 * Wait until all RabbitMQ queues are empty
 */
async function waitForQueuesDrained() {
  const channel = getChannel();
  
  while (true) {
    const bidQueue = await channel.checkQueue(QUEUES.BID_PERSIST);
    const statusQueue = await channel.checkQueue(QUEUES.AUCTION_STATUS);
    
    const totalPending = bidQueue.messageCount + statusQueue.messageCount;
    
    if (totalPending === 0) {
      console.log('✅ All queues drained - DB is up-to-date');
      return true;
    }
    
    console.log(`⏳ Waiting for ${totalPending} messages to be processed...`);
    await new Promise(r => setTimeout(r, 1000));  // Wait 1 second
  }
}

/**
 * Rebuild Redis cache from DB
 */
async function rebuildRedisFromDB() {
  console.log('🔄 Rebuilding Redis cache from DB...');
  
  // 1. Clear existing Redis data
  await redis.flushdb();
  
  // 2. Cache all ACTIVE auctions
  const activeAuctions = await con.query(`
    SELECT * FROM auctions WHERE status = 'active'
  `);
  
  for (const auction of activeAuctions.rows) {
    // Get current winning bid
    const winningBid = await con.query(`
      SELECT bidder_id, amount FROM bids 
      WHERE auction_id = $1 AND status = 'winning'
    `, [auction.id]);
    
    // Cache auction meta
    await redis.hset(`auction:${auction.id}:meta`, {
      status: auction.status,
      seller_id: String(auction.seller_id),
      starting_price: String(auction.starting_bid),
      bid_increment: String(auction.bid_increment || 1),
      end_time: String(new Date(auction.end_time).getTime()),
      total_bids: String(auction.total_bids || 0)
    });
    
    // Cache current bid
    await redis.set(`auction:${auction.id}:current_bid`, auction.current_bid);
    
    // Cache winner if exists
    if (winningBid.rows[0]) {
      await redis.set(`auction:${auction.id}:winner_id`, winningBid.rows[0].bidder_id);
    }
  }
  
  // 3. Cache all user balances
  const users = await con.query('SELECT id, balance FROM users');
  for (const user of users.rows) {
    await redis.set(`user:${user.id}:balance`, String(user.balance));
  }
  
  console.log(`✅ Rebuilt: ${activeAuctions.rows.length} auctions, ${users.rows.length} users`);
}

/**
 * Full recovery process
 */
async function performRecovery() {
  console.log('🚨 Starting Redis recovery...');
  
  // Step 1: Wait for queues to drain
  await waitForQueuesDrained();
  
  // Step 2: Rebuild Redis from DB
  await rebuildRedisFromDB();
  
  console.log('🎉 Recovery complete!');
}

module.exports = { waitForQueuesDrained, rebuildRedisFromDB, performRecovery };