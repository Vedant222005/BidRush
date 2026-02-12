const redis = require('../../config/redis');

//done
async function validateBid(userId, auctionId, bidAmount) {
  const pipe = redis.pipeline();

  // 1. Queue commands
  pipe.hgetall(`auction:${auctionId}:meta`);
  pipe.get(`auction:${auctionId}:current_bid`);
  pipe.get(`auction:${auctionId}:winner_id`);
  pipe.get(`user:${userId}:balance`);

  // 2. Execute & Destructure directly
  // ioredis returns [[err, result], [err, result], ...]
  const [
    [, meta], 
    [, currentBidStr], 
    [, winnerId], 
    [, balanceStr]
  ] = await pipe.exec();

  // 3. Fail Fast: Check existence
  if (!meta) {
    throw new Error(`Auction ${auctionId} not found`);
  }

  // 4. Parse values once for cleaner usage
  const status = meta.status;
  const endTime = Number(meta.end_time);
  const sellerId = String(meta.seller_id);
  const startingPrice = Number(meta.starting_price);
  const increment = Number(meta.bid_increment || 1);
  
  const userBalance = Number(balanceStr || 0);
  const currentHighestBid = Number(currentBidStr || 0);

  const isFirstBid = currentBidStr === null; // If null, no one has bid yet

  // --- VALIDATION CHECKS ---

  // A. Status & Time
  if (status !== 'active') throw new Error(`Auction is ${status}`);
  if (Date.now() > endTime) throw new Error('Auction has ended');

  // B. Identity
  if (sellerId === String(userId)) throw new Error('Cannot bid on your own item');
  if (String(winnerId) === String(userId)) throw new Error('You are already the highest bidder');

  // C. Financials
  if (userBalance <= bidAmount) {
    throw new Error(`Insufficient balance. Has: ${userBalance}, Needs: ${bidAmount}`);
  }

  // D. Minimum Bid Calculation
  // Rule: If it's the FIRST bid, you can bid the Starting Price.
  // Rule: If existing bids, you must bid Current + Increment.
  let minRequiredBid;
  
  if (isFirstBid) {
    minRequiredBid = startingPrice;
  } else {
    minRequiredBid = currentHighestBid + increment;
  }

  if (bidAmount < minRequiredBid) {
    throw new Error(`Bid too low. Current: ${isFirstBid ? 0 : currentHighestBid}, Min Required: ${minRequiredBid}`);
  }

  // Return data for the next step (storage)
  return {
    previousBid: isFirstBid ? 0 : currentHighestBid,
    previousWinnerId: winnerId
  };
}

module.exports = { validateBid };