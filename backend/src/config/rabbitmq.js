const amqp = require('amqplib');

let connection = null;
let channel = null;

// Queue names - SEPARATE QUEUES for different concerns
const QUEUES = {
  BID_PERSIST: 'bid-persist-queue',           // Bids ONLY
  AUCTION_STATUS: 'auction-status-queue',     // Auction status updates
  WINNER_EMAIL: 'winner-notification-queue'   // Winner emails
};

async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://Vedant:22nehulkar@localhost:5672/');
    channel = await connection.createChannel();
    
    // Assert ALL queues
    await channel.assertQueue(QUEUES.BID_PERSIST, { durable: true });
    await channel.assertQueue(QUEUES.AUCTION_STATUS, { durable: true });
    await channel.assertQueue(QUEUES.WINNER_EMAIL, { durable: true });
    
    console.log('✅ RabbitMQ connected - 3 queues ready');
    
    connection.on('error', (err) => console.error('❌ RabbitMQ error:', err));
    connection.on('close', () => { channel = null; connection = null; });
    
  } catch (err) {
    console.error('❌ Failed to connect to RabbitMQ:', err);
    throw err;
  }
}

function getChannel() {
  if (!channel) throw new Error('RabbitMQ not initialized');
  return channel;
}

async function closeRabbitMQ() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = { connectRabbitMQ, getChannel, closeRabbitMQ, QUEUES };
