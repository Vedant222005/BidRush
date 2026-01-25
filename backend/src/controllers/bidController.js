const con=require('../config/db');  

//with pagination
const getBids = async (req, res) => {
    try {
        const { auction_id } = req.params;
        
        // 1. Get pagination parameters from query string (e.g., ?page=1&limit=10)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // 2. Query for the actual data
        // We order by amount DESC to show the highest/latest bids first
        const fetch_query = `
            SELECT id, amount, status, placed_at 
            FROM bids 
            WHERE auction_id = $1 
            AND status != 'cancelled'
            ORDER BY amount DESC 
            LIMIT $2 OFFSET $3`;

        const result = await con.query(fetch_query, [auction_id, limit, offset]);

        // 3. Query for the total count (Useful for the frontend to calculate total pages)
        const countQuery = `
            SELECT COUNT(*) 
            FROM bids 
            WHERE auction_id = $1 AND status != 'cancelled'`;
        
        const countResult = await con.query(countQuery, [auction_id]);
        const totalBids = parseInt(countResult.rows[0].count);

        
        res.status(200).json({
            message: 'Bids fetched successfully',
            data: result.rows,
            pagination: {
                totalBids,
                currentPage: page,
                totalPages: Math.ceil(totalBids / limit),
                limit
            }
        });

    } catch (err) {
        console.error("GetBids Pagination Error:", err);
        res.status(500).json({ message: 'Failed to get bids' });
    }
};

//auction updation (version change)
const createBid = async (req, res) => {
  const client = await con.connect();  // Get dedicated connection
  try {
    const { auction_id } = req.params;
    const { bid_amount } = req.body;
    const user_id = req.user.id;  // From JWT middleware
    
    await client.query('BEGIN');
    
    // Add a check to see if the user is ALREADY the current winning bidder.
    // Usually, you shouldn't be allowed to outbid yourself unless it's a proxy bid.
    const lastBidderResult = await client.query(
          "SELECT bidder_id FROM bids WHERE auction_id = $1 AND status = 'winning'", [auction_id]
      );
      
    if (lastBidderResult.rows[0]?.bidder_id === user_id) {
          throw new Error('You are already the highest bidder');
      }

    // Step 1: Lock auction row - prevents race conditions!
    const auctionResult = await client.query(
      `SELECT id, current_bid, end_time, status, seller_id ,version
       FROM auctions 
       WHERE id = $1 
       FOR UPDATE`,  // Row-level lock
      [auction_id]
    );
    
    if (auctionResult.rows.length === 0) {
      throw new Error('Auction not found');
    }
    
    const auction = auctionResult.rows[0];
    
    // Step 2: Validations
    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }
    
    if (new Date() > new Date(auction.end_time)) {
      throw new Error('Auction has ended');
    }
    
    if (auction.seller_id === user_id) {
      throw new Error('Cannot bid on your own auction');
    }
    
    const minRequiredBid = parseFloat(auction.current_bid) + parseFloat(auction.bid_increment || 1.00);

    if (bid_amount < minRequiredBid) {
      throw new Error(`Minimum bid required is ${minRequiredBid}`);
    }
    
    // Step 3: Update previous winning bid status
    await client.query(
      `UPDATE bids SET status = 'outbid' 
       WHERE auction_id = $1 AND status = 'winning'`,
      [auction_id]
    );
    
    // Step 4: Insert new bid
    const bidResult = await client.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, status, ip_address) 
       VALUES ($1, $2, $3, 'winning', $4)
       RETURNING *`,
      [auction_id, user_id, bid_amount, req.ip]
    );
    
    // Step 5: Update auction
    await client.query(
      `UPDATE auctions 
       SET current_bid = $1, total_bids = total_bids + 1, version=version+1,last_bid_at = NOW()
       WHERE id = $2`,
      [bid_amount, auction_id]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      message: 'Bid placed successfully',
      bid: bidResult.rows[0]
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();  // Return connection to pool
  }
};

//with pagination
const getBidByUser = async (req, res) => {
  try {
    const user_id = req.user.id;
    
    // 1. Get pagination params from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 2. Query for the actual data with a JOIN to get auction titles
    const fetch_query = `
      SELECT b.id, b.amount, b.status, b.placed_at, a.title as auction_title, a.id as auction_id
      FROM bids b 
      JOIN auctions a ON b.auction_id = a.id 
      WHERE b.bidder_id = $1 
      ORDER BY b.placed_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await con.query(fetch_query, [user_id, limit, offset]);

    // 3. Query for total count (Essential for frontend pagination math)
    const countQuery = "SELECT COUNT(*) FROM bids WHERE bidder_id = $1";
    const countResult = await con.query(countQuery, [user_id]);
    const totalBids = parseInt(countResult.rows[0].count);

    res.status(200).json({
      message: "Fetched user's bids successfully",
      data: result.rows,
      pagination: {
        totalItems: totalBids,
        currentPage: page,
        totalPages: Math.ceil(totalBids / limit),
        limit: limit
      }
    });
  } catch (err) {
    console.error("GetBidByUser Error:", err);
    res.status(500).json({ message: "Failed to fetch user's bids" });
  }
};

const getWinningBid=async(req,res)=>{
    try{
        const {auction_id}=req.params;
        const fetch_query = "SELECT * FROM bids WHERE auction_id=$1 AND status != 'cancelled' ORDER BY amount DESC LIMIT 1";
        const result=await con.query(fetch_query,[auction_id]);
        
        res.status(200).json({
            message:'Bid fetched successfully',
            result:result
        });

    }
    catch(err){
        res.status(500).json({message:'failed to get winning bid'})
    }
};

//auction updation (version change)
const cancelBid = async (req, res) => {
    const { bid_id } = req.params;
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch Bid and Lock the Auction it belongs to
        // We join with auctions to get the current status and seller info
        const findBidQuery = `
            SELECT b.status,b.bidder_id, b.amount, b.auction_id, a.current_bid, a.status as auction_status
            FROM bids b
            JOIN auctions a ON b.auction_id = a.id
            WHERE b.id = $1
            FOR UPDATE OF a`; // Lock the auction row specifically
        
        const bidResult = await client.query(findBidQuery, [bid_id]);

        if (bidResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Bid not found' });
        }

        const bid = bidResult.rows[0];

        // 2. Business Logic Checks
        if (bid.status === 'cancelled') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Bid already cancelled' });
        }
        if (bid.auction_status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cannot cancel bids on a closed auction' });
        }

        if (bid.bidder_id !== user_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: "You can only cancel your own bids" });
        }

        // 3. Update Bid Status
        await client.query("UPDATE bids SET status = 'cancelled' WHERE id = $1", [bid_id]);

        // 4. Critical Step: If this was the WINNING bid, we must find the NEW winner
        if (bid.status === 'winning') {
            // Find the next highest active bid
            const nextBidResult = await client.query(
                `SELECT id, amount FROM bids 
                 WHERE auction_id = $1 AND status != 'cancelled' AND id != $2
                 ORDER BY amount DESC LIMIT 1`,
                [bid.auction_id, bid_id]
            );

            if (nextBidResult.rows.length > 0) {
                const nextBid = nextBidResult.rows[0];
                
                // Set the new winner
                await client.query("UPDATE bids SET status = 'winning' WHERE id = $1", [nextBid.id]);
                
                // Update Auction current price to the next highest bid
                await client.query(
                    `UPDATE auctions SET current_bid = $1, version = version + 1 WHERE id = $2`,
                    [nextBid.amount, bid.auction_id]
                );
            } else {
                // If NO other bids exist, reset auction to starting price (or 0)
                await client.query(
                    `UPDATE auctions SET current_bid = starting_bid, version = version + 1 WHERE id = $1`,
                    [bid.auction_id]
                );
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Bid cancelled and auction state recalculated' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

module.exports={getBids, createBid, getBidByUser, getWinningBid, cancelBid }