// jobs/auctionSchedular.js
const cron = require('node-cron');
const con = require('../config/db');
const { activateAuctionCore, endAuctionCore } = require('../controllers/auctionController');

const startAuctionScheduler = () => {
    console.log('⏰ Auction Scheduler Started...');

    // Runs every minute
    cron.schedule('* * * * *', async () => {
        try {
            // ====================================================
            // 1. ACTIVATION JOB (Pending -> Active)
            // Find auctions where start_time has passed
            // ====================================================
            const pendingAuctions = await con.query(`
                SELECT id, title 
                FROM auctions 
                WHERE status = 'pending' 
                AND start_time <= NOW()
                LIMIT 50
            `);

            if (pendingAuctions.rows.length > 0) {
                console.log(`🚀 Starting ${pendingAuctions.rows.length} auctions...`);
                for (const auction of pendingAuctions.rows) {
                    const result = await activateAuctionCore(auction.id);
                    console.log("hiii hello");
                    if (result.success) console.log(`✅ Started: ${auction.title}`);
                    else console.error(`❌ Failed Start: ${auction.title}`, result.error);
                }
            }

            // ====================================================
            // 2. ENDING JOB (Active -> Sold/Expired)
            // Find auctions where end_time has passed
            // endAuctionCore handles: Redis update, email queue, 
            // status queue (DB), and Socket.IO notification
            // ====================================================
            const endingAuctions = await con.query(`
                SELECT id, title 
                FROM auctions 
                WHERE status = 'active' 
                AND end_time <= NOW()
                LIMIT 50
            `);

            if (endingAuctions.rows.length > 0) {
                console.log(`🏁 Ending ${endingAuctions.rows.length} auctions...`);
                for (const auction of endingAuctions.rows) {
                    const result = await endAuctionCore(auction.id);
                    if (result.success) {
                        console.log(`✅ Ended: ${auction.title} (${result.status})`);
                    } else {
                        console.error(`❌ Failed End: ${auction.title}`, result.error);
                    }
                }
            }

        } catch (err) {
            console.error('❌ Scheduler Error:', err);
        }
    });
};

module.exports = { startAuctionScheduler };