const { getChannel, QUEUES } = require('../../config/rabbitmq');
const con = require('../../config/db');

async function startBidConsumer() {
  const channel = getChannel();
  await channel.prefetch(1);

  channel.consume(QUEUES.BID_PERSIST, async (msg) => {
    const client = await con.connect();
    try {
      const data = JSON.parse(msg.content.toString());
      await client.query('BEGIN');

      await client.query(`INSERT INTO bids (auction_id, bidder_id, amount, status) 
        VALUES ($1,$2,$3,'winning')`, [data.auction_id, data.bidder_id, data.amount]);
      await client.query(`UPDATE bids SET status='outbid' 
        WHERE auction_id=$1 AND bidder_id!=$2 AND status='winning'`,
        [data.auction_id, data.bidder_id]);
      await client.query(`UPDATE auctions SET current_bid=$1, total_bids=total_bids+1 
        WHERE id=$2`, [data.amount, data.auction_id]);

      await client.query(`UPDATE users SET balance=balance-$1 WHERE id=$2`,
        [data.amount, data.bidder_id]);
      if (data.previous_winner_id) {
        await client.query(`UPDATE users SET balance=balance+$1 WHERE id=$2`,
          [data.previous_bid, data.previous_winner_id]);
      }

      await client.query('COMMIT');
      channel.ack(msg);
    } catch (err) {
      await client.query('ROLLBACK');
      channel.nack(msg, false, true);
    } finally {
      client.release();
    }
  });
}

module.exports = { startBidConsumer };
