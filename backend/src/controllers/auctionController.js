const con=require('../config/db');  

//The Rule: Every "Write" must increment Version
//creating new auction 
const createAuction = async (req, res) => {
    const { title, description, category, starting_bid, end_time, images } = req.body;
    const seller_id = req.user.id;

    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // --- 1. BUSINESS VALIDATION ---

        // A. Image Requirement
        if (!images || images.length === 0) {
            throw new Error('At least one image is required to list an item.');
        }

        // B. Starting Bid Validation (Token System)
        if (parseFloat(starting_bid) <= 0) {
            throw new Error('Starting bid must be a positive number of tokens.');
        }

        // C. Time Validation: End Time must be in the future
        const now = Date.now(); // Returns a number (milliseconds), no object created
        const end = new Date(end_time).getTime(); // Converts to number

        // Now it's a simple number > number check, just like your bid check!
        if (!end || end <= now) {
            throw new Error('Auction end time must be in the future.');
        }
        // D. Optional: Minimum Duration (e.g., at least 1 hour long)
        const minDuration = 60 * 60 * 1000; // 1 hour in milliseconds
        if (end - now < minDuration) {
            throw new Error('Auction must run for at least 1 hour.');
        }

        // --- 2. INSERT AUCTION ---
        const auctionQuery = `
            INSERT INTO auctions (seller_id, title, description, category, starting_bid, current_bid, end_time, status)
            VALUES ($1, $2, $3, $4, $5, $5, $6, 'pending')
            RETURNING id`;
        
        const auctionRes = await client.query(auctionQuery, [
            seller_id, title, description, category, starting_bid, end
        ]);
        const auctionId = auctionRes.rows[0].id;

        // --- 3. INSERT IMAGES ---
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const imageQuery = `
                INSERT INTO auction_images (auction_id, image_url, storage_key, is_primary, display_order)
                VALUES ($1, $2, $3, $4, $5)`;
            
            await client.query(imageQuery, [
                auctionId, 
                img.url, 
                img.public_id, 
                i === 0, 
                i 
            ]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Auction created successfully and is now pending.',
            auction_id: auctionId
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

    // Fetch & Lock
    const { rows } = await client.query(
      `SELECT seller_id, total_bids, status, version FROM auctions WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Auction not found' });
    }

    const auction = rows[0];
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
    if (auction.status === 'cancelled' || auction.status === 'ended' || auction.status === 'sold') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Auction already closed' });
    }

    // Cancel the auction
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

    // TODO: If hasBids, add refund logic here for admin deletion

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

// Update auction - User only, before bids, cannot change status
const updateAuction = async (req, res) => {
  const { id } = req.params;
  const { title, description, category, reserve_price, end_time, version } = req.body;
  const userId = req.user.id;
  const client = await con.connect();

  try {
    await client.query('BEGIN');

    // Fetch & Lock
    const { rows } = await client.query(
      `SELECT seller_id, total_bids, version, status, end_time as current_end, title as current_title
       FROM auctions WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Auction not found' });
    }

    const auction = rows[0];

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

    // Update (NO status change allowed)
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

//getting all auctions pagination added
const getAllAuctions = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // 1. Fetch data with Primary Image
        // We use a LEFT JOIN so auctions show up even if they don't have an image yet
        const fetch_query = `
            SELECT 
                a.id, a.title, a.description, a.category, 
                a.starting_bid, a.current_bid, a.end_time, a.status,
                i.image_url AS primary_image
            FROM auctions a
            LEFT JOIN auction_images i ON a.id = i.auction_id AND i.is_primary = true
            WHERE a.status = 'active' 
            ORDER BY a.created_at DESC 
            LIMIT $1 OFFSET $2`;
        
        const result = await con.query(fetch_query, [limit, offset]);

        // 2. Fetch total count
        const countQuery = "SELECT COUNT(*) FROM auctions WHERE status = 'active'";
        const countResult = await con.query(countQuery);
        const totalItems = parseInt(countResult.rows[0].count);

        res.status(200).json({
            message: 'Auctions fetched successfully',
            data: result.rows,
            pagination: {
                totalItems,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalItems / limit),
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        console.error("Get Auctions Error:", err);
        res.status(500).json({ message: 'Failed to get auctions' });    
    }
}

//getting auction owned by user with pagination
const getUserAuctions = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 5 } = req.query; // Default to 5 for profile views
        const offset = (page - 1) * limit;

        // 1. Fetch data with Primary Image
        const fetch_query = `
            SELECT 
                a.id, a.title, a.current_bid, a.status, a.end_time, a.total_bids,
                i.image_url AS primary_image
            FROM auctions a
            LEFT JOIN auction_images i ON a.id = i.auction_id AND i.is_primary = true
            WHERE a.seller_id = $1
            ORDER BY a.created_at DESC 
            LIMIT $2 OFFSET $3`;
        
        const result = await con.query(fetch_query, [userId, limit, offset]);

        // 2. Fetch total count for this specific user
        const countQuery = "SELECT COUNT(*) FROM auctions WHERE seller_id = $1";
        const countResult = await con.query(countQuery, [userId]);
        const totalItems = parseInt(countResult.rows[0].count);

        res.status(200).json({
            message: 'User auctions fetched successfully',
            data: result.rows,
            pagination: {
                totalItems,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalItems / limit),
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        console.error("GetUserAuctions Error:", err);
        res.status(500).json({ message: 'Failed to get user auctions' });    
    }
}

// Get single auction by ID
const getAuctionById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        a.*,
        u.username as seller_name,
        json_agg(json_build_object(
          'url', ai.image_url,
          'is_primary', ai.is_primary
        )) as images
      FROM auctions a
      JOIN users u ON a.seller_id = u.id
      LEFT JOIN auction_images ai ON a.id = ai.auction_id
      WHERE a.id = $1
      GROUP BY a.id, u.username`;

    const result = await con.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    res.json({
      message: 'Auction fetched successfully',
      data: result.rows[0]
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

    const query = `
      SELECT 
        a.id, a.title, a.status, a.current_bid, a.total_bids, 
        a.end_time, a.created_at,
        u.username as seller_name,
        i.image_url as primary_image
      FROM auctions a
      JOIN users u ON a.seller_id = u.id
      LEFT JOIN auction_images i ON a.id = i.auction_id AND i.is_primary = true
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2`;

    const result = await con.query(query, [limit, offset]);

    const countResult = await con.query('SELECT COUNT(*) FROM auctions');
    const totalItems = parseInt(countResult.rows[0].count);

    res.json({
      message: 'Auctions fetched successfully',
      data: result.rows,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
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

    // Fetch & Lock
    const { rows } = await client.query(
      `SELECT status, end_time, version FROM auctions WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Auction not found' });
    }

    const auction = rows[0];

    // Validation
    if (auction.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Only pending auctions can be activated' });
    }

    if (new Date(auction.end_time) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'End time has passed. Cannot activate.' });
    }

    // Activate
    const result = await client.query(
      `UPDATE auctions 
       SET status = 'active', start_time = NOW(), version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [id, auction.version]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Version conflict' });
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Auction activated!', auction: result.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Activate Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports={createAuction,deleteAuction,updateAuction,getAllAuctions,getUserAuctions,getAuctionById,getAllAuctionsAdmin,activateAuction};
