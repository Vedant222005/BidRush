const redis = require('../../config/redis');
const con = require('../../config/db');

async function CUpdateUserBalance(userId, balance, amount) {
  await redis.set(`user:${userId}:balance`, String(balance + amount));
}

//done
async function CTotalBids(auctionId) {
  const totalBids = await redis.hget(
    `auction:${auctionId}:meta`,
    'total_bids'
  );
  const totalBidsNum = parseInt(totalBids);
  return totalBidsNum;
}

//return winningbidderId and current Bid (done)
const CwinningBid = async (auctionId) => {
    const pipe = redis.pipeline();
    pipe.get(`auction:${auctionId}:winner_id`);
    pipe.get(`auction:${auctionId}:current_bid`);
    
    const results = await pipe.exec();
    const winnerId = results[0][1];
    const amount = results[1][1];

    if (!winnerId) return null; // No bid exists

    return {
        winningBidderId: parseInt(winnerId),
        current_bid: parseFloat(amount)
    };
};

// services/redisService.js

const CresetAuctionAndRefund = async (auctionId, startPrice) => {
    const luaScript = `
        local metaKey = KEYS[1]
        local bidKey = KEYS[2]
        local winnerKey = KEYS[3]
        
        local newPrice = ARGV[1]

        -- 1. Get Current Winner & Amount (before we delete them)
        local winnerId = redis.call('GET', winnerKey)
        local currentBid = tonumber(redis.call('GET', bidKey))
        local refundedUserId = nil
        local newBalance = 0

        -- 2. Refund the Redis Winner (Instant Visual Refund)
        if winnerId and currentBid and currentBid > 0 then
            local userKey = "user:" .. winnerId
            newBalance = redis.call('HINCRBYFLOAT', userKey, 'balance', currentBid)
            refundedUserId = winnerId
        end

        -- 3. Reset Auction State
        redis.call('HSET', metaKey, 'total_bids', 0, 'status', 'active')
        redis.call('DEL', winnerKey)           -- No winner
        redis.call('SET', bidKey, newPrice)    -- Back to start price

        -- 4. Return Details
        return { refundedUserId, tostring(newBalance) }
    `;

    const keys = [
        `auction:${auctionId}:meta`,
        `auction:${auctionId}:current_bid`,
        `auction:${auctionId}:winner_id`
    ];

    try {
        const result = await redis.eval(luaScript, 3, ...keys, startPrice);
        
        return {
            refundedUserId: result[0],
            newBalance: result[1]
        };
    } catch (err) {
        console.error("Redis Reset Error:", err);
        return { refundedUserId: null };
    }
};

// services/redisService.js

const CcancelAuction = async (auctionId) => {
  // LUA SCRIPT: Performs Cancel + Refund atomically
  const luaScript = `
    local metaKey = KEYS[1]
    local bidKey = KEYS[2]
    local winnerKey = KEYS[3]
    local ttl = ARGV[1]

    -- 1. Check if auction exists
    if redis.call('EXISTS', metaKey) == 0 then 
        return {-1, "Auction not found"} 
    end

    -- 2. Check if already cancelled
    local currentStatus = redis.call('HGET', metaKey, 'status')
    if currentStatus == 'cancelled' then
        return {-2, "Already cancelled"}
    end

    -- 3. Mark as cancelled immediately
    redis.call('HSET', metaKey, 'status', 'cancelled')

    -- 4. GET WINNER INFO
    local winnerId = redis.call('GET', winnerKey)
    local amountStr = redis.call('GET', bidKey)
    local amount = tonumber(amountStr)
    local newBalance = 0
    local refundedUserId = nil

    -- 5. REFUND (If a winner exists)
    if winnerId and amount and amount > 0 then
        local userKey = "user:" .. winnerId
        newBalance = redis.call('HINCRBYFLOAT', userKey, 'balance', amount)
        refundedUserId = winnerId
    end

    -- 6. Set Expiry (Cleanup)
    redis.call('EXPIRE', metaKey, ttl)
    redis.call('EXPIRE', bidKey, ttl)
    redis.call('EXPIRE', winnerKey, ttl)

    -- 7. RETURN: [Success(1), WinnerID, RefundAmount, NewBalance]
    return {1, refundedUserId, amountStr, tostring(newBalance)}
  `;

  const keys = [
    `auction:${auctionId}:meta`,
    `auction:${auctionId}:current_bid`,
    `auction:${auctionId}:winner_id`
  ];
  const ttlInSeconds = 3600; // 1 hour

  try {
    const result = await redis.eval(luaScript, 3, ...keys, ttlInSeconds);
    
    // Handle Lua Errors
    if (result[0] === -1) return { error: "Auction not found in Redis" };
    if (result[0] === -2) return { error: "Auction already cancelled" };

    return {
      success: true,
      refundedUserId: result[1],      // User ID (or null)
      refundedAmount: result[2],      // Amount refunded
      newBalance: result[3]           // New Wallet Balance
    };

  } catch (err) {
    console.error("Lua Script Error:", err);
    throw err;
  }
};

async function CauctionCache(auction) {
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

module.exports = { CUpdateUserBalance, CTotalBids, CwinningBid, CresetAuctionAndRefund, CcancelAuction, CauctionCache };
