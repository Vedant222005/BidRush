const { getChannel } = require('../../config/rabbitmq');
const nodemailer = require('nodemailer');

const EMAIL_QUEUE = 'email_queue';

// Configure Nodemailer (Use Env Vars!)
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const startEmailConsumer = async () => {
    try {
        const channel = getChannel();
        if (!channel) {
            console.error('❌ RabbitMQ channel missing for Email Consumer');
            return;
        }

        await channel.assertQueue(EMAIL_QUEUE, { durable: true });
        
        // 1. CRITICAL: Only process 1 email at a time per worker
        // This prevents Gmail from blocking you for spamming connections
        channel.prefetch(1);

        console.log('📧 Email Worker Started. Waiting for messages...');

        channel.consume(EMAIL_QUEUE, async (msg) => {
            if (msg !== null) {
                const emailData = JSON.parse(msg.content.toString());

                try {
                    // Send the email
                    await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: emailData.to,
                        subject: emailData.subject,
                        text: emailData.text,
                        html: emailData.html
                    });
                    
                    console.log(`✅ Email sent to ${emailData.to}`);
                    
                    // 2. Success: Remove from queue
                    channel.ack(msg);

                } catch (err) {
                    console.error(`❌ Failed to send email to ${emailData.to}:`, err.message);

                    // 3. CRITICAL: Handle the failure
                    // Option A (Safest): Ack it anyway to discard the bad email.
                    // This prevents "Poison Messages" from crashing your loop.
                    channel.ack(msg); 
                    
                    // Option B (Advanced): Retry once, then discard (requires logic).
                    // Option C (Dangerous): channel.nack(msg); <- Creates infinite loops!
                }
            }
        });
    } catch (err) {
        console.error('Email Consumer Setup Error:', err);
    }
};

module.exports = { startEmailConsumer };