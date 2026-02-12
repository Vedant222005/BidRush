const { getChannel, QUEUES } = require('../../config/rabbitmq');
function publishStatusChange(data) {
  getChannel().sendToQueue(QUEUES.AUCTION_STATUS,
    Buffer.from(JSON.stringify(data)),
    { persistent: true }
  );
}
module.exports = { publishStatusChange };