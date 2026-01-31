const con = require('../config/db');
const AuctionRepo = require('../repositories/auctionRepository');

// Create new auction
const createAuction = async (req, res) => {
    const { title, description, category, starting_bid, end_time, images } = req.body;
    const seller_id = req.user.id;

    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // --- 1. BUSINESS VALIDATION ---

        if (!images || images.length === 0) {
            throw new Error('At least one image is required to list an item.');
        }

        if (parseFloat(starting_bid) <= 0) {
            throw new Error('Starting bid must be a positive number of tokens.');
        }

        const now = Date.now();
        const end = new Date(end_time).getTime();

        if (!end || end <= now) {
            throw new Error('Auction end time must be in the future.');
        }

        const minDuration = 60 * 60 * 1000; // 1 hour
        if (end - now < minDuration) {
            throw new Error('Auction must run for at least 1 hour.');
        }

        // --- 2. CREATE AUCTION USING REPOSITORY ---
        const endDate = new Date(end_time);

        const auction = await AuctionRepo.createAuction(client, {
            seller_id,
            title,
            description,
            category,
            starting_bid,
            end_time: endDate
        });

        // --- 3. INSERT IMAGES USING REPOSITORY ---
        await AuctionRepo.insertAuctionImages(client, auction.id, images);

        await client.query('COMMIT');

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

// Delete (Cancel) auction - User before bids, Admin anytime
const deleteAuction = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // Use repository to fetch and lock
        const auction = await AuctionRepo.lockAndGetAuction(client, id);

        if (!auction) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Auction not found' });
        }

        const isOwner = auction.seller_id === userId;
        const hasBids = auction.total_bids > 0;

        // Authorization
        if (!isOwner && !isAdmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // User can only delete if NO bids
        if (hasBids && !isAdmin) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'Cannot delete auction with bids. Contact admin.'
            });
        }

        // Already cancelled/ended
        if (['cancelled', 'ended', 'sold'].includes(auction.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Auction already closed' });
        }

        // Cancel the auction (we'll keep this query in controller for now as it's a special status update)
        const result = await client.query(
            `UPDATE auctions 
             SET status = 'cancelled', version = version + 1, updated_at = NOW()
             WHERE id = $1 AND version = $2
             RETURNING *`,
            [id, auction.version]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Version conflict' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Auction cancelled', auction: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete Error:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

// Update auction - User only, before bids
const updateAuction = async (req, res) => {
    const { id } = req.params;
    const { title, description, category, reserve_price, end_time, version } = req.body;
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

        // Version check
        if (auction.version !== Number(version)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Data outdated. Please refresh.' });
        }

        // Cannot update closed auctions
        if (['cancelled', 'ended', 'sold'].includes(auction.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot update closed auction' });
        }

        // End time validation
        if (end_time && new Date(end_time) <= new Date()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'End time must be in the future' });
        }

        // Update (keeping this in controller as it's complex update logic)
        const result = await client.query(
            `UPDATE auctions
             SET 
               title = COALESCE($1, title),
               description = COALESCE($2, description),
               category = COALESCE($3, category),
               reserve_price = COALESCE($4, reserve_price),
               end_time = COALESCE($5, end_time),
               version = version + 1,
               updated_at = NOW()
             WHERE id = $6 AND version = $7
             RETURNING *`,
            [title || null, description || null, category || null, reserve_price || null, end_time || null, id, version]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Update failed (version conflict)' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Auction updated', auction: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update Error:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

// Get all active auctions with pagination
const getAllAuctions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Use repository
        const auctions = await AuctionRepo.getAllAuctions(con, {
            status: 'active',
            limit,
            offset
        });

        const totalItems = await AuctionRepo.getAuctionCount(con, {
            status: 'active'
        });

        res.status(200).json({
            message: 'Auctions fetched successfully',
            data: auctions,
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

// Get auctions by seller
const getUserAuctions = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        // Use repository
        const auctions = await AuctionRepo.getAuctionsBySeller(con, userId, limit, offset);
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

// Get single auction by ID
const getAuctionById = async (req, res) => {
    try {
        const { id } = req.params;

        // Use repository
        const auction = await AuctionRepo.getAuctionById(con, id);

        if (!auction) {
            return res.status(404).json({ message: 'Auction not found' });
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

// Get all auctions for admin (any status)
const getAllAuctionsAdmin = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Use repository - no status filter for admin
        const auctions = await AuctionRepo.getAllAuctions(con, {
            limit,
            offset
        });

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

// Activate auction - Admin Only
const activateAuction = async (req, res) => {
    const { id } = req.params;
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // Use repository to fetch and lock
        const auction = await AuctionRepo.lockAndGetAuction(client, id);

        if (!auction) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Auction not found' });
        }

        // Validation
        if (auction.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Only pending auctions can be activated' });
        }

        if (new Date(auction.end_time) <= new Date()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'End time has passed. Cannot activate.' });
        }

        // Activate using repository
        const activatedAuction = await AuctionRepo.activateAuction(client, id, auction.version);

        if (!activatedAuction) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Version conflict' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Auction activated!', auction: activatedAuction });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Activate Error:', err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
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
    activateAuction
};