const redis = require('../../config/redis');

async function validateAndCancel(auctionId, userId, userRole) {
  const lua = `
    local meta = redis.call('HGETALL', KEYS[1])
    if #meta == 0 then return {0, 'Auction not found'} end

    local auction = {}
    for i = 1, #meta, 2 do
      auction[meta[i]] = meta[i+1]
    end

    if auction['status'] == 'ended' or auction['status'] == 'cancelled' then
      return {0, 'Auction already ended or cancelled'}
    end

    local winnerId = redis.call('GET', KEYS[3])
    local hasBids = (winnerId and winnerId ~= '') and 1 or 0

    if ARGV[1] ~= 'admin' then
      if auction['seller_id'] ~= ARGV[2] then
        return {0, 'Not authorized'}
      end
      if hasBids == 1 then
        return {0, 'Cannot cancel with bids. Contact admin.'}
      end
    end

    redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
    return {1, hasBids}
  `;

  const keys = [
    `auction:${auctionId}:meta`,
    `auction:${auctionId}:current_bid`,
    `auction:${auctionId}:winner_id`
  ];

  const result = await redis.eval(
    lua,
    keys.length,
    ...keys,
    userRole,
    String(userId)
  );

  return result[0] === 1
    ? { success: true, hasBids: result[1] === 1 }
    : { success: false, error: result[1] };
}

module.exports = { validateAndCancel };
