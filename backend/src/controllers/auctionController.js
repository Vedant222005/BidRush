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


//delete auction (write operation)
const deleteAuction = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch and Lock the auction
        const checkQuery = `
            SELECT seller_id, total_bids, status ,version
            FROM auctions 
            WHERE id = $1 
            FOR UPDATE`;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Auction not found" });
        }

        const auction = checkResult.rows[0];

        // 2. Security: Only owner can delete
        if (auction.seller_id !== user_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: "Unauthorized" });
        }

        // 3. Integrity: Cannot delete if bids exist
        // If there are bids, the seller must "cancel" it (which might have penalties)
        if (auction.total_bids > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                message: "Cannot delete auction with active bids. Please contact support to cancel." 
            });
        }

        // 4. Perform Soft Delete (Status Change)
        const deleteQuery = `
            UPDATE auctions 
            SET status = 'cancelled', 
            updated_at = NOW() ,
            version=version+1
            WHERE id = $1 AND status IN ('active', 'pending')
            RETURNING id`;
        
        await client.query(deleteQuery, [id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Auction cancelled successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};


//update Auction (write operation)
const updateAuction = async (req, res) => {
    const { id } = req.params;
    const { title, description, category, reserve_price, status, version, end_time } = req.body;
    const user_id = req.user.id;

    // 1. Get a dedicated client from the pool
    const client = await con.connect(); 

    try {
        // 2. Start the Transaction
        await client.query('BEGIN');

        // 3. Fetch & Lock the row
        const checkQuery = `
            SELECT seller_id, total_bids, version, status, end_time, title 
            FROM auctions 
            WHERE id = $1 
            FOR UPDATE`;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Auction not found" });
        }

        const auction = checkResult.rows[0];

        // 4. Security & Concurrency Checks
        if (auction.seller_id !== user_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: "Unauthorized" });
        }
        
        if (auction.version !== parseInt(version)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "Conflict: Data is stale. Refresh required." });
        }

        // 5. Business Logic (Timing & Integrity)
        if (end_time) {
            const newEndTime = new Date(end_time);
            if (newEndTime <= new Date()) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "End time must be in the future" });
            }
            if (auction.total_bids > 0 && newEndTime < new Date(auction.end_time)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "Cannot shorten duration after bids exist" });
            }
        }

        if (title && auction.total_bids > 0 && title !== auction.title) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Cannot change title after bidding starts" });
        }

        if (auction.status === 'ended' || auction.status === 'sold' ) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Cannot update a closed auction" });
        }
        if (auction.status === 'cancelled' ) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Cannot update a cancelled auction" });
        }


        // 6. The Atomic Update (Note: $7 and $8 used for WHERE)
        const updateQuery = `
            UPDATE auctions 
            SET 
                title = COALESCE($1, title), 
                description = COALESCE($2, description), 
                category = COALESCE($3, category),
                reserve_price = COALESCE($4, reserve_price),
                status = COALESCE($5, status),
                end_time = COALESCE($6, end_time),
                version = version + 1,
                updated_at = NOW()
            WHERE id = $7 AND version = $8 
            RETURNING *`;

        const values = [
            title || null, 
            description || null, 
            category || null, 
            reserve_price || null, 
            status || null, 
            end_time || null,
            id, 
            version
        ];

        const result = await client.query(updateQuery, values);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: "Update failed (Version Conflict)" });
        }

        // 7. Commit everything
        await client.query('COMMIT');

        res.status(200).json({
            message: 'Auction updated successfully',
            auction: result.rows[0]
        });

    } catch (err) {
        // 8. Rollback on any crash
        await client.query('ROLLBACK');
        console.error("Update Error:", err);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        // 9. IMPORTANT: Release the client back to the pool
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


//activate auction (write operation)
const activateAuction = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  
  // 1. Get dedicated client
  const client = await con.connect();

  try {
    await client.query('BEGIN');

    // 2. Fetch & Lock
    const checkQuery = "SELECT seller_id, status, end_time, version FROM auctions WHERE id = $1 FOR UPDATE";
    const checkResult = await client.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Auction not found' });
    }

    const auction = checkResult.rows[0];

    // 3. Business Logic Validations
    if (auction.seller_id !== user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Unauthorized' });
    }
    if (auction.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Only pending auctions can be activated' });
    }
    if (new Date(auction.end_time) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'End time has passed. Update end time first.' });
    }

    // 4. Atomic State Transition
    const update_query = `
      UPDATE auctions 
      SET status = 'active', 
          start_time = NOW(),
          version = version + 1
      WHERE id = $1 AND status = 'pending' AND version = $2
      RETURNING *
    `;
    
    const result = await client.query(update_query, [id, auction.version]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Conflict: Version mismatch.' });
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Auction is now live!',
      auction: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    // 5. Always release back to pool
    client.release();
  }
};

module.exports={createAuction,deleteAuction,updateAuction,getAllAuctions,getUserAuctions,activateAuction};
