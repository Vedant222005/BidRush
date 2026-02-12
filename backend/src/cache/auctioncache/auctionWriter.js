const redis = require('../../config/redis');

// LUA SCRIPT: Performs all updates atomically
// Returns: { newBalance, previousWinnerBalance } OR -1 (if bid is too low)
const STORE_BID_LUA = `
  -- 1. RACE CONDITION CHECK
  -- Fetch current bid from Redis (or 0 if first bid)
  local currentBid = tonumber(redis.call('GET', KEYS[2]) or 0)
  local newBid = tonumber(ARGV[1])

  -- If the incoming bid is NOT higher than current, reject it immediately
  if newBid <= currentBid then
      return -1 
  end

  -- 2. DEDUCT MONEY from New Bidder
  -- KEYS[1]: user:{userId}:balance
  local newBalance = redis.call('INCRBYFLOAT', KEYS[1], -newBid)

  -- 3. UPDATE AUCTION STATE
  -- KEYS[2]: auction:{id}:current_bid
  -- KEYS[3]: auction:{id}:winner_id
  -- KEYS[4]: auction:{id}:meta
  redis.call('SET', KEYS[2], ARGV[1])          -- Update Price
  redis.call('SET', KEYS[3], ARGV[2])          -- Update Winner ID
  redis.call('HINCRBY', KEYS[4], 'total_bids', 1) -- Increment Count

  -- 4. REFUND PREVIOUS WINNER (if exists)
  -- KEYS[5]: user:{prevWinnerId}:balance
  local prevWinnerBalance = 0
  if ARGV[3] ~= '' then
      prevWinnerBalance = redis.call('INCRBYFLOAT', KEYS[5], tonumber(ARGV[4]))
  end

  -- 5. RETURN RESULTS
  -- Returns: [newBalance, prevWinnerBalance]
  return { newBalance, prevWinnerBalance }
`;

async function storeBid({ userId, auctionId, bidAmount, previousWinnerId, previousBid }) {
  // Define Redis Keys
  const keys = [
    `user:${userId}:balance`,                // KEYS[1]
    `auction:${auctionId}:current_bid`,      // KEYS[2]
    `auction:${auctionId}:winner_id`,        // KEYS[3]
    `auction:${auctionId}:meta`,             // KEYS[4]
    `user:${previousWinnerId || 'none'}:balance` // KEYS[5] (Safe dummy key if no prev winner)
  ];

  // Execute Script
  const result = await redis.eval(
    STORE_BID_LUA,
    keys.length,
    ...keys,
    bidAmount.toString(),         // ARGV[1]
    userId.toString(),            // ARGV[2]
    previousWinnerId || '',       // ARGV[3]
    (previousBid || 0).toString() // ARGV[4]
  );

  // Handle Race Condition Error
  if (result === -1) {
    return -1;
  }

  // Parse Results
  return {
    newBalance: parseFloat(result[0]),
    previousWinnerBalance: parseFloat(result[1])
  };
}

module.exports = { storeBid };