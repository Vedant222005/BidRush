const con = require('../config/db');
const redis = require('../config/redis');
const AuctionRepo = require('../repositories/auctionRepository');
const { emitAuctionUpdate } = require('../webSocket/socketServer');
const { emitNewAuction, emitBalanceUpdate } = require('../webSocket/socketServer');
const BidRepo = require('../repositories/bidRepository');
const UserRepo = require('../repositories/userRepository');
const { CcancelAuction, CUpdateUserBalance, CauctionCache,CTotalBids, CwinningBid} = require('../cache/Functions/functions');
const { publishStatusChange } = require('../queues/status/statusProducer');
const { sendEmailQueue } = require('../queues/email/emailProducer');

// Create new auction(redis)(done)
const createAuction = async (req, res) => {
    const { title, description, category, start_time, starting_bid, end_time, images } = req.body;
    const seller_id = req.user.id;

    const client = await con.connect();

    try {
        await client.query('BEGIN');

        if (!images || images.length === 0) {
            throw new Error('At least one image is required to list an item.');
        }

        if (parseFloat(starting_bid) <= 0) {
            throw new Error('Starting bid must be a positive number of tokens.');
        }

        const now = Date.now();
        const end = new Date(end_time).getTime();
        const start = new Date(start_time).getTime();

        if (!start || start <= now) {
            throw new Error('Auction start time must be in the future.');
        }

        if (!end || end <= now) {
            throw new Error('Auction end time must be in the future.');
        }

        if (end < start) {
            throw new Error('Auction end time must be greater than start time');
        }

        const minDuration = 60 * 60 * 1000; // 1 hour
        if (end - start < minDuration) {
            throw new Error('Auction must run for at least 1 hour.');
        }

        // --- 2. CREATE AUCTION USING REPOSITORY ---
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);

        const auction = await AuctionRepo.createAuction(client, {
            seller_id,
            title,
            description,
            category,
            starting_bid,
            start_time: startDate,
            end_time: endDate
        });
        await AuctionRepo.insertAuctionImages(client, auction.id, images);

        await client.query('COMMIT');

        emitNewAuction({
            ...auction,
            seller_name: req.user.username
        });

        res.status(201).json({
            message: 'Auction created successfully and is now pending.',
            auction_id: auction.id
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Auction Creation Error:", err.message);
        res.status(400).json({ message: err.message || 'Failed to create auction' });
    } finally {
        client.release();
    }
};

// Delete (Cancel) auction - User before bids, Admin anytime(redis)(refund logic)(done)
const deleteAuction = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // 1. READ-ONLY VALIDATION
    // We check permissions but DO NOT lock DB rows yet.
    const client = await con.connect();
    try {
        const { rows } = await client.query('SELECT * FROM auctions WHERE id = $1', [id]);
        const auction = rows[0];
         
        if (!auction) return res.status(404).json({ message: 'Not found' });
        if (auction.seller_id !== userId && !isAdmin) return res.status(403).json({ message: 'Unauthorized' });
        
        // 2. ATOMIC REDIS CANCEL & REFUND
        // This stops new bids and updates the winner's cached balance instantly.
        const redisResult = await CcancelAuction(id); // Use the Lua script provided earlier

        if (redisResult.error) {
             return res.status(400).json({ message: redisResult.error });
        }

        // 3. REAL-TIME UPDATES (Speed Layer)
        // Frontend gets the update immediately.
        const updatedAuction = { ...auction, status: 'cancelled', updated_at: new Date() };
        emitAuctionUpdate(updatedAuction);

        if (redisResult.refundedUserId) {
            emitBalanceUpdate(
                Number(redisResult.refundedUserId), 
                Number(redisResult.newBalance)
            );
        }

        // 4. QUEUE THE COMMAND (Truth Layer)
        // We tell the worker: "Once you finish processing pending bids, close this auction."
        publishStatusChange({
            type: 'CANCEL_AUCTION_COMMAND',
            auctionId: id,
            reason: 'Admin Delete',
            timestamp: Date.now()
        });

        return res.status(200).json({ message: 'Auction cancelled', auction: updatedAuction });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
};

const cancelAuction = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // 1. READ-ONLY VALIDATION
    // We check permissions but DO NOT lock DB rows yet.
    const client = await con.connect();
    try {
        const { rows } = await client.query('SELECT * FROM auctions WHERE id = $1', [id]);
        const auction = rows[0];
         
        if (!auction) return res.status(404).json({ message: 'Not found' });
        if (auction.seller_id !== userId && !isAdmin) return res.status(403).json({ message: 'Unauthorized' });
        
        await AuctionRepo.dbcancelAuction(client,id);

        
        // Frontend gets the update immediately.
        const updatedAuction = { ...auction, status: 'cancelled', updated_at: new Date() };
        emitAuctionUpdate(updatedAuction);

        if (redisResult.refundedUserId) {
            emitBalanceUpdate(
                Number(redisResult.refundedUserId), 
                Number(redisResult.newBalance)
            );
        }
        return res.status(200).json({ message: 'Auction cancelled', auction: updatedAuction });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error' });
    } finally {
        client.release();
    }
};

// Update auction - User only, before bids (check version)(done)
const updateAuction = async (req, res) => {
    const { id } = req.params;
    const { title, description, category } = req.body;
    const userId = req.user.id;
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // Use repository to fetch and lock
        const auction = await AuctionRepo.lockAndGetAuction(client, id);

        if (!auction) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Auction not found' });
        }

        // Only owner can update
        if (auction.seller_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Cannot update after bids
        if (auction.total_bids > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot update after bidding starts' });
        }

        // Cannot update closed auctions
        if (['cancelled', 'ended', 'sold'].includes(auction.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot update closed auction' });
        }
        // Update (keeping this in controller as it's complex update logic)
        const result = await client.query(
            `UPDATE auctions
             SET 
               title = COALESCE($1, title),
               description = COALESCE($2, description),
               category = COALESCE($3, category),
               updated_at = NOW()
             WHERE id = $4 
             RETURNING *`,
            [title || null, description || null, category || null]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Update failed (version conflict)' });
        }

        await client.query('COMMIT');

        // Real-time update
        emitAuctionUpdate(result.rows[0]);

        res.status(200).json({ message: 'Auction updated', auction: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update Error:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

// Get all auctions with pagination(only chnage active acution data)(done)
const getAllAuctions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Parse status (e.g. ?status=active,sold)
        const statusParam = req.query.status;
        const statusFilter = statusParam ? statusParam.split(',') : ['active'];

        // 1. Fetch Base Data from Postgres
        // We fetch the items first based on the DB's knowledge
        let auctions = await AuctionRepo.getAllAuctions(con, {
            status: statusFilter,
            limit,
            offset
        });

        // 2. Overlay Redis Data (Price AND Status)
        // We use Promise.all to fetch Redis data for all items in parallel (Faster)
        const enrichedAuctions = await Promise.all(auctions.map(async (auction) => {
            // We only check Redis for 'active' auctions. 
            // If DB says 'sold', it's final. If DB says 'active', it might be 'cancelled' in Redis.
            if (auction.status === 'active') {
                try {
                    const pipe = redis.pipeline();
                    
                    // Queue up commands
                    pipe.get(`auction:${auction.id}:current_bid`);
                    pipe.hget(`auction:${auction.id}:meta`, 'total_bids');
                    pipe.hget(`auction:${auction.id}:meta`, 'status'); // <--- CRITICAL: Get real-time status

                    // Execute all at once
                    const results = await pipe.exec();
                    
                    // Results format: [[err, value], [err, value], [err, value]]
                    const currentBid = results[0][1];
                    const totalBids = results[1][1];
                    const redisStatus = results[2][1];

                    // Overlay: Update Price
                    if (currentBid) {
                        auction.current_bid = parseFloat(currentBid);
                    }
                    
                    // Overlay: Update Bid Count
                    if (totalBids) {
                        auction.total_bids = parseInt(totalBids);
                    }

                    // Overlay: Update Status 
                    // (This fixes the "Zombie Auction" issue where DB is slow to update)
                    if (redisStatus && redisStatus !== auction.status) {
                        auction.status = redisStatus; 
                    }

                } catch (redisErr) {
                    console.error(`Redis lookup failed for auction ${auction.id}`, redisErr);
                    // On error, we just keep the DB values. No need to crash.
                }
            }
            return auction;
        }));

        // 3. (Optional) Consistency Filter
        // If the user requested ONLY 'active' auctions, but Redis revealed one is actually 'cancelled',
        // we should remove it from this list to prevent frontend confusion.
        const finalAuctions = enrichedAuctions.filter(a => statusFilter.includes(a.status));

        // 4. Get Total Count (From DB)
        // Note: This might be slightly off by 1-2 items during the "sync gap", but that is acceptable for pagination.
        const totalItems = await AuctionRepo.getAuctionCount(con, {
            status: statusFilter
        });

        res.status(200).json({
            message: 'Auctions fetched successfully',
            data: finalAuctions,
            pagination: {
                totalItems,
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                limit
            }
        });

    } catch (err) {
        console.error("Get Auctions Error:", err);
        res.status(500).json({ message: 'Failed to get auctions' });
    }
};

// Get auctions by seller(only chnage active acution data)(done)
const getUserAuctions = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        // 1. Fetch Base Data from DB
        const auctions = await AuctionRepo.getAuctionsBySeller(con, userId, limit, offset);

        // 2. Overlay Redis Data (Price, Bids, AND Status)
        // Use Promise.all for parallel fetching
        await Promise.all(auctions.map(async (auction) => {
            if (auction.status === 'active') {
                try {
                    const pipe = redis.pipeline();
                    
                    pipe.get(`auction:${auction.id}:current_bid`);
                    pipe.hget(`auction:${auction.id}:meta`, 'total_bids');
                    pipe.hget(`auction:${auction.id}:meta`, 'status'); // <--- CRITICAL STATUS CHECK

                    const results = await pipe.exec();

                    // Extract results safely
                    const currentBid = results[0][1];
                    const totalBids = results[1][1];
                    const redisStatus = results[2][1];

                    if (currentBid) {
                        auction.current_bid = parseFloat(currentBid);
                    }
                    if (totalBids) {
                        auction.total_bids = parseInt(totalBids);
                    }
                    
                    // Override status if Redis is ahead of DB (e.g. just cancelled)
                    if (redisStatus && redisStatus !== auction.status) {
                        auction.status = redisStatus;
                    }

                } catch (redisErr) {
                    console.error(`Redis skip for auction ${auction.id}`, redisErr);
                    // Continue with DB values if Redis fails
                }
            }
        }));

        const totalItems = await AuctionRepo.getSellerAuctionCount(con, userId);

        res.status(200).json({
            message: 'User auctions fetched successfully',
            data: auctions,
            pagination: {
                totalItems,
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                limit
            }
        });
    } catch (err) {
        console.error("GetUserAuctions Error:", err);
        res.status(500).json({ message: 'Failed to get user auctions' });
    }
};

// Get single auction by ID(only chnage active acution data)(done)
const getAuctionById = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get base auction data from DB
        const auction = await AuctionRepo.getAuctionById(con, id);

        if (!auction) {
            return res.status(404).json({ message: 'Auction not found' });
        }

        // 2. For ACTIVE auctions, overlay Redis data (real-time)
        // If DB says 'sold' or 'cancelled', we trust it.
        // If DB says 'active', we must verify with Redis in case it was just cancelled.
        if (auction.status === 'active') {
            try {
                const pipe = redis.pipeline();
                
                // Get Price & Winner
                pipe.get(`auction:${id}:current_bid`);
                pipe.get(`auction:${id}:winner_id`);
                
                // Get Meta (Bids Count & STATUS)
                pipe.hget(`auction:${id}:meta`, 'total_bids');
                pipe.hget(`auction:${id}:meta`, 'status'); // <--- CRITICAL ADDITION

                const results = await pipe.exec();

                // Extract Results: [[err, val], [err, val], ...]
                const currentBid = results[0][1];
                const winnerId = results[1][1];
                const totalBids = results[2][1];
                const redisStatus = results[3][1];

                // Overlay Price
                if (currentBid !== null) {
                    auction.current_bid = parseFloat(currentBid);
                }
                
                // Overlay Winner
                if (winnerId !== null) {
                    auction.winner_id = parseInt(winnerId);
                }
                
                // Overlay Total Bids
                if (totalBids !== null) {
                    auction.total_bids = parseInt(totalBids);
                }

                // Overlay Status (Fixes the "Zombie Auction" issue)
                if (redisStatus && redisStatus !== auction.status) {
                    auction.status = redisStatus;
                }

            } catch (redisErr) {
                console.warn('Redis overlay failed, using DB values:', redisErr.message);
            }
        }

        res.json({
            message: 'Auction fetched successfully',
            data: auction
        });
        
    } catch (err) {
        console.error('GetAuctionById error:', err);
        res.status(500).json({ message: 'Failed to get auction' });
    }
};

// Get all auctions for admin (any status)(only chnage active acution data)(done)
const getAllAuctionsAdmin = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // 1. Fetch ALL data from DB (No status filter for admins)
        const auctions = await AuctionRepo.getAllAuctions(con, {
            limit,
            offset
        });

        // 2. Overlay Redis Data (Price, Bids, AND Status)
        // Use Promise.all for speed
        await Promise.all(auctions.map(async (auction) => {
            // Only check Redis if DB thinks it's active.
            // If DB says 'cancelled', it's definitely cancelled.
            if (auction.status === 'active') {
                try {
                    const pipe = redis.pipeline();
                    
                    pipe.get(`auction:${auction.id}:current_bid`);
                    pipe.hget(`auction:${auction.id}:meta`, 'total_bids');
                    pipe.hget(`auction:${auction.id}:meta`, 'status'); // <--- CRITICAL FOR ADMINS

                    const results = await pipe.exec();

                    // Extract results: [[err, val], [err, val], ...]
                    const currentBid = results[0][1];
                    const totalBids = results[1][1];
                    const redisStatus = results[2][1];

                    if (currentBid) {
                        auction.current_bid = parseFloat(currentBid);
                    }
                    if (totalBids) {
                        auction.total_bids = parseInt(totalBids);
                    }
                    
                    // Force the UI to show 'Cancelled' if Redis knows it's cancelled
                    // This prevents the Admin from seeing "Active" right after deleting.
                    if (redisStatus && redisStatus !== auction.status) {
                        auction.status = redisStatus;
                    }

                } catch (redisErr) {
                    // For Admin lists, we generally DON'T want to fail the whole request
                    // just because Redis is glitchy. We log it and show the DB data.
                    console.error(`Admin List: Redis skip for auction ${auction.id}`, redisErr);
                }
            }
        }));

        const totalItems = await AuctionRepo.getAuctionCount(con, {});
        const activeCount = await AuctionRepo.getAuctionCount(con, { status: 'active' });

        res.json({
            message: 'Auctions fetched successfully',
            data: auctions,
            pagination: {
                totalItems,
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                active_count: activeCount,
                limit
            }
        });
    } catch (err) {
        console.error('GetAllAuctionsAdmin error:', err);
        res.status(500).json({ message: 'Failed to get auctions' });
    }
};

//  1. CORE LOGIC (Reusable for Admin & Cron)(done)
const activateAuctionCore = async (auctionId) => {
    const client = await con.connect();
    try {
        await client.query('BEGIN');

        // A. Lock & Fetch
        const auction = await AuctionRepo.lockAndGetAuction(client, auctionId);

        if (!auction) {
            await client.query('ROLLBACK');
            return { success: false, error: 'NOT_FOUND', status: 404 };
        }

        // B. Validation
        if (auction.status !== 'pending') {
            await client.query('ROLLBACK');
            return { success: false, error: 'Auction is not pending', status: 400 };
        }
        
        // (Optional: Check start time only if triggered by Cron? 
        //  Usually admin override is allowed, but let's keep strict for now)
        if (new Date(auction.end_time) <= new Date()) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Auction end time passed', status: 400 };
        }

        // C. Update DB
        const activatedAuction = await AuctionRepo.activateAuction(client, auctionId);

        // if (!activatedAuction) {
        //     await client.query('ROLLBACK');
        //     return { success: false, error: 'Version Conflict', status: 409 };
        // }

        await client.query('COMMIT');

        // D. Seed Redis (Critical for performance)
        try {
            await CauctionCache(activatedAuction);
        } catch (redisErr) {
            console.error(`[ActivateCore] Redis Seed Failed for #${auctionId}:`, redisErr);
        }

        // E. Real-time Notification
        emitAuctionUpdate(activatedAuction);

        return { success: true, data: activatedAuction };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[ActivateCore] Error for #${auctionId}:`, err);
        return { success: false, error: err.message, status: 500 };
    } finally {
        client.release();
    }
};

//  2. HTTP HANDLER (For Admin API)(done)
const activateAuction = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Call the reusable core function
        const result = await activateAuctionCore(id);

        if (!result.success) {
            return res.status(result.status || 500).json({ message: result.error });
        }

        res.status(200).json({ 
            message: 'Auction activated successfully', 
            auction: result.data 
        });

    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

//done
const endAuctionCore = async (auctionId) => {
    try {
        const pipe = redis.pipeline();
        pipe.hgetall(`auction:${auctionId}:meta`);       // status, total_bids, seller_id
        pipe.get(`auction:${auctionId}:current_bid`);     // final price
        pipe.get(`auction:${auctionId}:winner_id`);       // winner user ID

        const results = await pipe.exec();

        const meta       = results[0][1];   // { status, total_bids, seller_id, ... }
        const currentBid = results[1][1];   // "5000" (string)
        const winnerId   = results[2][1];   // "17" (string) or null

        // Guard: Auction doesn't exist in Redis
        if (!meta ) {
            return { success: false, error: 'Auction not found in cache' };
        }

        // Guard: Already ended
        if (meta.status === 'sold' || meta.status === 'ended' || meta.status === 'cancelled') {
            return { success: false, error: `Auction already ${meta.status}` };
        }

        const totalBids = parseInt(meta.total_bids) || 0;
        const newStatus = (totalBids > 0 && winnerId) ? 'sold' : 'expired';


        await redis.hset(`auction:${auctionId}:meta`, 'status', newStatus);
        // Set TTL to auto-cleanup after 24 hours
        await redis.expire(`auction:${auctionId}:meta`, 86400);
        await redis.expire(`auction:${auctionId}:current_bid`, 86400);
        await redis.expire(`auction:${auctionId}:winner_id`, 86400);


        let winner = null;
        let seller = null;

        // We need emails, so we query Users DB
        if (newStatus === 'sold' && winnerId) {
            const winnerRes = await con.query(
                "SELECT id, email, username FROM users WHERE id = $1",
                [parseInt(winnerId)]
            );
            winner = winnerRes.rows[0];
        }

        // Get seller email
        if (meta.seller_id) {
            const sellerRes = await con.query(
                "SELECT id, email, username FROM users WHERE id = $1",
                [parseInt(meta.seller_id)]
            );
            seller = sellerRes.rows[0];
        }

        publishStatusChange({
            type: 'END_AUCTION_COMMAND',
            auctionId: parseInt(auctionId),
            newStatus,
            winnerId: winnerId ? parseInt(winnerId) : null,
            finalPrice: currentBid ? parseFloat(currentBid) : 0,
            timestamp: Date.now()
        });

        if (newStatus === 'sold' && winner && seller) {
            // A. Email to Winner
            sendEmailQueue({
                to: winner.email,
                subject: `🎉 You Won: Auction #${auctionId}`,
                html: `<h2>Congratulations ${winner.username}!</h2>
                       <p>You won the auction with a bid of ₹${parseFloat(currentBid).toLocaleString('en-IN')}.</p>`
            });

            // B. Email to Seller
            sendEmailQueue({
                to: seller.email,
                subject: `✅ Auction Sold: #${auctionId}`,
                html: `<h2>Your auction was sold!</h2>
                       <p>Winner: ${winner.username}</p>
                       <p>Final Price: ₹${parseFloat(currentBid).toLocaleString('en-IN')}</p>`
            });
        } else if (seller) {
            // C. Email to Seller (Expired)
            sendEmailQueue({
                to: seller.email,
                subject: `⏰ Auction Expired: #${auctionId}`,
                html: `<h2>Your auction expired with no bids.</h2>`
            });
        }

        emitAuctionUpdate({
            id: parseInt(auctionId),
            status: newStatus,
            winner_id: winnerId ? parseInt(winnerId) : null,
            current_bid: currentBid ? parseFloat(currentBid) : 0
        });

        return { success: true, status: newStatus };

    } catch (err) {
        console.error(`[EndCore] Error closing #${auctionId}:`, err);
        return { success: false, error: err.message };
    }
};

module.exports = {
    createAuction,
    deleteAuction,
    updateAuction,
    getAllAuctions,
    getUserAuctions,
    getAuctionById,
    getAllAuctionsAdmin,
    activateAuctionCore,
    activateAuction,
    activateAuctionCore,
    cancelAuction,
     endAuctionCore
};