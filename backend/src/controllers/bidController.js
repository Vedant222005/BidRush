const con=require('../config/db');  


const getBids=async(req,res)=>{
    try{
        const {auction_id}=req.params;
        const fetch_query="select * from bids where auction_id=$1";
        const result=await con.query(fetch_query,[auction_id]);
        
        console.log(result);
        res.status(200).json({
            message:'Bids fetched successfully',
            result:result
        });

    }
    catch(err){
        res.status(500).json({message:'failed to get bids'})
    }
};


const createBid = async (req, res) => {
  const client = await con.connect();  // Get dedicated connection
  try {
    const { auction_id } = req.params;
    const { bid_amount } = req.body;
    const user_id = req.user.id;  // From JWT middleware
    
    await client.query('BEGIN');
    
    // Step 1: Lock auction row - prevents race conditions!
    const auctionResult = await client.query(
      `SELECT id, current_bid, end_time, status, seller_id 
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
    
    if (bid_amount <= auction.current_bid) {
      throw new Error(`Bid must be higher than ${auction.current_bid}`);
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
       SET current_bid = $1, total_bids = total_bids + 1, last_bid_at = NOW()
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

const getBidByUser = async (req, res) => {
  try {
    const user_id = req.user.id;
    
    const fetch_query = `
      SELECT b.*, a.title as auction_title 
      FROM bids b 
      JOIN auctions a ON b.auction_id = a.id 
      WHERE b.bidder_id = $1 
      ORDER BY b.placed_at DESC
    `;
    const result = await con.query(fetch_query, [user_id]);
    
    res.status(200).json({
      message: "Fetched user's bids successfully",
      bids: result.rows
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user's bids" });
  }
};

const getWinningBid=async(req,res)=>{
    try{
        const {auction_id}=req.params;
        const fetch_query="select * from bids where auction_id=$1 order by amount DESC limit 1";
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

const cancelBid=async(req,res)=>{
    try{
        const {bid_id}=req.params;
         
        const checkQuery = "SELECT status FROM bids WHERE id=$1";
        const checkResult = await con.query(checkQuery, [bid_id]);

        if (checkResult.rows.length === 0) {
          return res.status(404).json({ message: 'Bid not found' });
        }
        if (checkResult.rows[0].status === 'cancelled') {
          return res.status(400).json({ message: 'Bid already cancelled' });
        }
        
        //returning * will return the updated row  
        const update_query = "UPDATE bids SET status='cancelled' WHERE id=$1 RETURNING *";
        const result=await con.query(update_query,[bid_id]);    

        res.status(200).json({
            message:'Bid canceled successfully',
            result:result.rows[0]
        });

    }
    catch(err){
        res.status(500).json({message:'failed to cancel bid'})
    }
};

module.exports={getBids, createBid, getBidByUser, getWinningBid, cancelBid }