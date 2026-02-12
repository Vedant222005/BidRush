const { getChannel, QUEUES } = require('../../config/rabbitmq');

function publishBid(data) {
  getChannel().sendToQueue(QUEUES.BID_PERSIST, 
    Buffer.from(JSON.stringify({ type: 'BID', ...data })),
    { persistent: true }
  );
}

module.exports = { publishBid };
