/**
 * Auction Repository
 * 
 * PURPOSE:
 * - All database queries related to auctions
 * - Separates data access from business logic
 * - Reusable across multiple controllers
 */

/**
 * Create new auction
 */
const createAuction = async (client, auctionData) => {
    const { seller_id, title, description, category, starting_bid, end_time } = auctionData;

    const result = await client.query(
        `INSERT INTO auctions (seller_id, title, description, category, starting_bid, current_bid, end_time, status)
     VALUES ($1, $2, $3, $4, $5, $5, $6, 'pending')
     RETURNING id`,
        [seller_id, title, description, category, starting_bid, end_time]
    );

    return result.rows[0];
};

/**
 * Insert auction images
 */
const insertAuctionImages = async (client, auctionId, images) => {
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        await client.query(
            `INSERT INTO auction_images (auction_id, image_url, storage_key, is_primary, display_order)
       VALUES ($1, $2, $3, $4, $5)`,
            [auctionId, img.url, img.public_id, i === 0, i]
        );
    }
};

/**
 * Lock and get auction (for transactions)
 */
const lockAndGetAuction = async (client, auctionId) => {
    const result = await client.query(
        `SELECT id, seller_id, title, current_bid, starting_bid, end_time, status, total_bids, version, bid_increment
     FROM auctions 
     WHERE id = $1 
     FOR UPDATE`,
        [auctionId]
    );
    return result.rows[0];
};

/**
 * Get auction by ID (no lock)
 */
const getAuctionById = async (con, auctionId) => {
    const result = await con.query(
        `SELECT a.*, 
            ARRAY_AGG(ai.image_url ORDER BY ai.display_order) as images
     FROM auctions a
     LEFT JOIN auction_images ai ON a.id = ai.auction_id
     WHERE a.id = $1
     GROUP BY a.id`,
        [auctionId]
    );
    return result.rows[0];
};

/**
 * Get all auctions with filters and pagination
 */
const getAllAuctions = async (con, filters) => {
    const { status, category, limit, offset } = filters;

    let query = `
    SELECT a.id, a.title, a.description, a.category, a.current_bid, a.starting_bid,
           a.end_time, a.status, a.total_bids, a.created_at,
           (SELECT image_url FROM auction_images WHERE auction_id = a.id AND is_primary = true LIMIT 1) as primary_image
    FROM auctions a
    WHERE 1=1`;

    const params = [];
    let paramCount = 1;

    if (status) {
        query += ` AND a.status = $${paramCount}`;
        params.push(status);
        paramCount++;
    }

    if (category) {
        query += ` AND a.category = $${paramCount}`;
        params.push(category);
        paramCount++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await con.query(query, params);
    return result.rows;
};

/**
 * Get total auction count with filters
 */
const getAuctionCount = async (con, filters) => {
    const { status, category } = filters;

    let query = 'SELECT COUNT(*) FROM auctions WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (status) {
        query += ` AND status = $${paramCount}`;
        params.push(status);
        paramCount++;
    }

    if (category) {
        query += ` AND category = $${paramCount}`;
        params.push(category);
    }

    const result = await con.query(query, params);
    return parseInt(result.rows[0].count);
};

/**
 * Update auction current bid and total bids
 */
const updateAuctionBid = async (client, auctionId, bidAmount) => {
    await client.query(
        `UPDATE auctions 
     SET current_bid = $1, total_bids = total_bids + 1, version = version + 1, last_bid_at = NOW()
     WHERE id = $2`,
        [bidAmount, auctionId]
    );
};

/**
 * Activate auction (Admin only)
 */
const activateAuction = async (client, auctionId, version) => {
    const result = await client.query(
        `UPDATE auctions 
     SET status = 'active', version = version + 1
     WHERE id = $1 AND version = $2
     RETURNING *`,
        [auctionId, version]
    );
    return result.rows[0];
};

/**
 * Delete auction
 */
const deleteAuction = async (client, auctionId) => {
    await client.query('DELETE FROM auctions WHERE id = $1', [auctionId]);
};

/**
 * Get auctions by seller
 */
const getAuctionsBySeller = async (con, sellerId, limit, offset) => {
    const result = await con.query(
        `SELECT a.id, a.title, a.status, a.current_bid, a.total_bids, a.end_time, a.created_at,
            (SELECT image_url FROM auction_images WHERE auction_id = a.id AND is_primary = true LIMIT 1) as primary_image
     FROM auctions a
     WHERE a.seller_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
        [sellerId, limit, offset]
    );
    return result.rows;
};

/**
 * Get seller auction count
 */
const getSellerAuctionCount = async (con, sellerId) => {
    const result = await con.query(
        'SELECT COUNT(*) FROM auctions WHERE seller_id = $1',
        [sellerId]
    );
    return parseInt(result.rows[0].count);
};

/**
 * Reset auction to starting state (after bid cancel)
 */
const resetAuction = async (client, auctionId) => {
    await client.query(
        `UPDATE auctions 
     SET current_bid = starting_bid, 
         total_bids = 0, 
         version = version + 1,
         last_bid_at = NULL
     WHERE id = $1`,
        [auctionId]
    );
};

module.exports = {
    createAuction,
    insertAuctionImages,
    lockAndGetAuction,
    getAuctionById,
    getAllAuctions,
    getAuctionCount,
    updateAuctionBid,
    activateAuction,
    deleteAuction,
    getAuctionsBySeller,
    getSellerAuctionCount,
    resetAuction
};
