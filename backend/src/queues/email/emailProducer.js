const { getChannel } = require('../../config/rabbitmq');

const EMAIL_QUEUE = 'email_queue';
let queueAsserted = false; // Optimization flag


const sendEmailQueue = async (emailData) => {
    try {
        const channel = getChannel();
        
        // 1. Safety Check
        if (!channel) {
            console.error('❌ RabbitMQ channel not available. Email failed.');
            return;
        }

        // 2. Optimization: Assert queue only once per app restart
        if (!queueAsserted) {
            await channel.assertQueue(EMAIL_QUEUE, { durable: true });
            queueAsserted = true; 
            console.log('✅ Email queue asserted');
        }
        
        // 3. Send to Queue
        const isSent = channel.sendToQueue(
            EMAIL_QUEUE, 
            Buffer.from(JSON.stringify(emailData)), 
            { persistent: true } // Saves to disk if RabbitMQ restarts
        );

        if (isSent) {
            console.log(`📧 Queued email to: ${emailData.to}`);
        } else {
            console.warn(`⚠️ Email queue buffer full. Message to ${emailData.to} might be delayed.`);
        }

    } catch (err) {
        // Log error but don't crash the app
        console.error('❌ Failed to queue email:', err.message);
    }
};

module.exports = { sendEmailQueue };