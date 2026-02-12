/**
 * Bid Repository
 * 
 * PURPOSE:
 * - All database queries related to bids
 * - Separates data access from business logic
 * - Reusable across multiple controllers
 */

// Get bids for an auction with pagination (done)
const getBidsByAuction = async (con, auctionId, limit, offset) => {
    const result = await con.query(
        `SELECT b.id, b.amount, b.status, b.placed_at, b.auction_id,
            u.username, u.id as bidder_id
     FROM bids b
     JOIN users u ON b.bidder_id = u.id
     WHERE b.auction_id = $1 AND b.status != 'cancelled'
     ORDER BY b.placed_at DESC
     LIMIT $2 OFFSET $3`,
        [auctionId, limit, offset]
    );
    return result.rows;
};

/**
 * Get bid count for an auction
 */
const getBidCount = async (con, auctionId) => {
    const result = await con.query(
        `SELECT COUNT(*) FROM bids WHERE auction_id = $1 AND status != 'cancelled'`,
        [auctionId]
    );
    return parseInt(result.rows[0].count);
};

/**
 * Get winning bid for an auction
 */
const getWinningBid = async (con, auctionId) => {
    const result = await con.query(
        `SELECT b.*, u.username 
     FROM bids b
     JOIN users u ON b.bidder_id = u.id
     WHERE b.auction_id = $1 AND b.status = 'winning'
     LIMIT 1`,
        [auctionId]
    );
    return result.rows[0];
};

/**
 * Get current winning bid with lock
 */
const lockAndGetWinningBid = async (client, auctionId) => {
    const result = await client.query(
        `SELECT bidder_id, amount FROM bids 
     WHERE auction_id = $1 AND status = 'winning' 
     FOR UPDATE`,
        [auctionId]
    );
    return result.rows[0];
};

/**
 * Create new bid
 */
const createBid = async (client, bidData) => {
    const { auction_id, bidder_id, amount, ip_address } = bidData;

    const result = await client.query(
        `INSERT INTO bids (auction_id, bidder_id, amount, status, ip_address) 
     VALUES ($1, $2, $3, 'winning', $4) 
     RETURNING *`,
        [auction_id, bidder_id, amount, ip_address]
    );

    return result.rows[0];
};

/**
 * Update previous winning bid to outbid
 */
const markBidAsOutbid = async (client, auctionId) => {
    await client.query(
        `UPDATE bids SET status = 'outbid' 
     WHERE auction_id = $1 AND status = 'winning'`,
        [auctionId]
    );
};

/**
 * Get user's bids with pagination
 */
const getUserBids = async (con, userId, limit, offset) => {
    const result = await con.query(
        `SELECT b.id, b.amount, b.status, b.placed_at,
            a.id as auction_id, a.title as auction_title, a.status as auction_status
     FROM bids b
     JOIN auctions a ON b.auction_id = a.id
     WHERE b.bidder_id = $1 AND b.status != 'cancelled'
     ORDER BY b.placed_at DESC
     LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );
    return result.rows;
};

/**
 * Get user bid count
 */
const getUserBidCount = async (con, userId) => {
    const result = await con.query(
        `SELECT COUNT(*) FROM bids WHERE bidder_id = $1 AND status != 'cancelled'`,
        [userId]
    );
    return parseInt(result.rows[0].count);
};

//Cancel bid (done)
const cancelBid = async (client, bidId) => {
    await client.query(
        `UPDATE bids SET status = 'cancelled' WHERE id = $1`,
        [bidId]
    );

};

//Get bid by ID with auction and user info (for cancel operation)(done)(for update)
const getBidWithDetails = async (client, bidId) => {
    const result = await client.query(
        `SELECT b.id, b.status, b.bidder_id, b.amount, b.auction_id, 
            a.status as auction_status, a.starting_bid
     FROM bids b
     JOIN auctions a ON b.auction_id = a.id
     JOIN users u ON b.bidder_id = u.id
     WHERE b.id = $1
     FOR UPDATE OF a, u`,
        [bidId]
    );
    return result.rows[0];
};

//Get all bids (admin) with pagination and optional auction filter (done)
const getAllBids = async (con, filters) => {
    const { limit, offset, auction_id } = filters;

    let query = `
        SELECT b.id, b.amount, b.status, b.placed_at, b.auction_id,
               u.username, a.title as auction_title
        FROM bids b
        JOIN users u ON b.bidder_id = u.id
        JOIN auctions a ON b.auction_id = a.id
        WHERE 1=1`;

    const params = [];
    let paramCount = 1;

    // Add auction filter if provided
    if (auction_id) {
        query += ` AND b.auction_id = $${paramCount}`;
        params.push(auction_id);
        paramCount++;
    }

    query += ` ORDER BY b.placed_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await con.query(query, params);
    return result.rows;
};

/**
 * Get total bid count (admin) with optional auction filter
 */
const getTotalBidCount = async (con, auction_id = null) => {
    let query = 'SELECT COUNT(*) FROM bids';
    const params = [];

    if (auction_id) {
        query += ' WHERE auction_id = $1';
        params.push(auction_id);
    }

    const result = await con.query(query, params);
    return parseInt(result.rows[0].count);
};

module.exports = {
    getBidsByAuction,
    getBidCount,
    getWinningBid,
    lockAndGetWinningBid,
    createBid,
    markBidAsOutbid,
    getUserBids,
    getUserBidCount,
    cancelBid,
    getBidWithDetails,
    getAllBids,
    getTotalBidCount
};
