const { getChannel, QUEUES } = require('../../config/rabbitmq');
const con = require('../../config/db');
const redis = require('../../config/redis');

async function startStatusConsumer() {
  const channel = getChannel();
  await channel.prefetch(1);
  
  channel.consume(QUEUES.AUCTION_STATUS, async (msg) => {
    const client = await con.connect();
    try {
      const data = JSON.parse(msg.content.toString());
      console.log(data);
      await client.query('BEGIN');
      
      // ====================================================
      // CANCEL: Refund all winning bids
      // ====================================================
      if (data.type === 'AUCTION_CANCELLED') {
        await client.query(
          `UPDATE auctions SET status='cancelled' WHERE id=$1`,
          [data.auction_id]
        );
        
        if (data.hasBids) {
          const bids = await client.query(
            `SELECT bidder_id, amount FROM bids 
             WHERE auction_id=$1 AND status='winning'`,
            [data.auction_id]
          );
          for (const bid of bids.rows) {
            await client.query(
              `UPDATE users SET balance=balance+$1 WHERE id=$2`,
              [bid.amount, bid.bidder_id]
            );
            await redis.incrbyfloat(`user:${bid.bidder_id}:balance`, bid.amount);
          }
          await client.query(
            `UPDATE bids SET status='refunded' WHERE auction_id=$1`,
            [data.auction_id]
          );
        }
      }

      // ====================================================
      // END: Just update status (sold/expired)
      // No refund needed — only 1 winning bid, money already deducted
      // ====================================================
      if (data.type === 'END_AUCTION_COMMAND') {
        // 1. Update auction status
        await client.query(
          `UPDATE auctions SET status=$1, updated_at=NOW() WHERE id=$2`,
          [data.newStatus, data.auctionId]
        );

        // 2. If SOLD, mark winning bid as 'won' and update auction winner
        if (data.newStatus === 'sold' && data.winnerId) {
          // Mark the winning bid record
          await client.query(
            `UPDATE bids SET status='won' 
             WHERE auction_id=$1 AND bidder_id=$2 AND status='winning'`,
            [data.auctionId, data.winnerId]
          );

          // Set winner on auction record
          await client.query(
            `UPDATE auctions SET winner_id=$1, current_bid=$2 
             WHERE id=$3`,
            [data.winnerId, data.finalPrice, data.auctionId]
          );
        }

        // 3. If EXPIRED, mark any remaining bids as 'expired'
        if (data.newStatus === 'expired') {
          await client.query(
            `UPDATE bids SET status='expired' WHERE auction_id=$1 AND status='winning'`,
            [data.auctionId]
          );
        }
      }
      
      await client.query('COMMIT');
      channel.ack(msg);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Status Consumer Error:', err.message);
      channel.nack(msg, false, true); // Retry
    } finally {
      client.release();
    }
  });
}

module.exports = { startStatusConsumer };