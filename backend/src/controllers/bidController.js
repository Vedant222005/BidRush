const con = require('../config/db');
const { emitNewBid, emitBalanceUpdate, emitAuctionReset } = require('../webSocket/socketServer');
const BidRepo = require('../repositories/bidRepository');
const AuctionRepo = require('../repositories/auctionRepository');
const UserRepo = require('../repositories/userRepository');
const { publishBid } = require('../queues/bids/bidproducer')
const { CTotalBids, CwinningBid, CresetAuctionAndRefund} = require('../cache/Functions/functions');
const { validateBid } = require('../cache/auctioncache/bidValidator');
const { storeBid } = require('../cache/auctioncache/auctionWriter');

// Get bids for an auction with pagination(bidHistory) (done)
const getBids = async (req, res) => {
  try {
    const { auction_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Use repository
    const bids = await BidRepo.getBidsByAuction(con, auction_id, limit, offset);
    const totalBids = await BidRepo.getBidCount(con, auction_id);

    res.status(200).json({
      message: 'Bids fetched successfully',
      data: bids,
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

// Get winning bid for an auction(redis)(done)
const getWinningBid = async (req, res) => {
  const { auction_id } = req.params;
  try {
      const{winningBidderId,current_bid} = await CwinningBid(auction_id);

    if (!winningBidderId) {
      throw new Error('winningBidderId not found ')
    }
    const winningBid={
      winningBidderId,
      current_bid
    }
    res.json({
      message: 'Winning bid fetched successfully',
      data: winningBid
    });
  }
  catch (err) {
        console.error('Bid Error:', err.message);
        if (err.message.includes('ECONNREFUSED')) {
          return res.status(503).json({
            message: 'Bidding service is temporarily unavailable.',
            retryAfter: 5
          });
        }
        return res.status(400).json({ message: err.message });
          
    }
};

// Create new bid(redis)(done)
const createBid = async (req, res) => {
  try {
    const { auction_id } = req.params;
    const { bid_amount } = req.body;
    const user_id = req.user.id;

    // --- STEP 1: VALIDATION ---
    // Checks balance, time, ownership, and "current" price visibility
    const { previousBid, previousWinnerId } = await validateBid(user_id, auction_id, bid_amount);
    

    // --- STEP 2: ATOMIC EXECUTION (Redis) ---

    const result = await storeBid({
      userId: user_id,
      auctionId: auction_id,
      bidAmount: bid_amount,
      previousWinnerId,
      previousBid
    });
    
    // --- STEP 3: HANDLE RACE CONDITIONS ---
    // If Redis returns -1, it means someone else outbid this user 
    // in the milliseconds between validateBid() and storeBid()
    if (result === -1) {
      return res.status(409).json({ 
        message: 'Bid rejected: The price increased while you were bidding. Please refresh and try again.',
        error: 'RACE_CONDITION'
      });
    }

    // Extract updated balances
    //return float
    const { newBalance, previousWinnerBalance } = result;

    // A. Notify Backend Workers (RabbitMQ) for DB sync
    publishBid({ 
      auction_id, 
      bidder_id: user_id, 
      amount: bid_amount, 
      previous_winner_id: previousWinnerId, 
      previous_bid: previousBid ,
    });

    // B. Update Frontend (Public Auction View)
    emitNewBid({ 
      auction_id: parseInt(auction_id), 
      bidder_id: user_id, 
      amount: bid_amount 
    });

    // C. Private Updates (User Balances)
    // Update the Current Bidder
 
    emitBalanceUpdate(user_id, newBalance);

    // Refund the Previous Winner (if there was one)
    if (previousWinnerId) {
      emitBalanceUpdate(previousWinnerId, previousWinnerBalance);
    }

    // --- STEP 5: RESPONSE ---
    return res.status(201).json({ 
      message: 'Bid placed successfully!', 
      newBalance,
      currentBid: bid_amount 
    });

  } catch (err) {
    console.error('Bid Error:', err.message);

    // Handle Redis Crash specifically
    if (err.message.includes('ECONNREFUSED')) {
       return res.status(503).json({
         message: 'Bidding service is temporarily unavailable.',
         retryAfter: 5
       });
    }

    // Handle Validation Errors (Insufficient funds, auction ended, etc.)
    
    return res.status(400).json({ message: err.message });
  }
};

// Get user's bids(my bids)(done)
const getUserBids = async (req, res) => {
  try {
    const user_id = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Use repository
    const bids = await BidRepo.getUserBids(con, user_id, limit, offset);
    const totalBids = await BidRepo.getUserBidCount(con, user_id);

    res.json({
      message: 'User bids fetched successfully',
      data: bids,
      pagination: {
        totalBids,
        currentPage: page,
        totalPages: Math.ceil(totalBids / limit),
        limit
      }
    });
  } catch (err) {
    console.error("GetUserBids Error:", err);
    res.status(500).json({ message: 'Failed to get user bids' });
  }
};

// Cancel bid - Admin only (done)
const cancelBid = async (req, res) => {
    const { bid_id } = req.params;
    const client = await con.connect();

    try {
        await client.query('BEGIN');

        // 1. FETCH BID & DETAILS (Locking not strictly necessary if we rely on optimistic locking later, but good for safety)
        const bid = await BidRepo.getBidWithDetails(client, bid_id);

        if (!bid) throw new Error('Bid not found');

        // 2. VALIDATION
        if (bid.status !== 'winning') {
            throw new Error('Only the current winning bid can be cancelled.');
        }
        if (bid.auction_status !== 'active') {
            throw new Error('Cannot cancel bids on closed auctions.');
        }

        // 3. DB ACTION: Refund the DB Winner
        // We refund the user recorded in the DB.
        const refundedUser = await UserRepo.updateBalance(
            client,
            bid.bidder_id,
            parseFloat(bid.amount),
            bid.user_version
        );

        if (!refundedUser) {
            throw new Error('Concurrency Error: User balance mismatch.');
        }

        // 4. DB ACTION: Cancel the Bid Record 
        await BidRepo.cancelBid(client, bid_id);

        // 5. DB ACTION: Reset Auction & INCREMENT VERSION
        // We increment 'version' to invalidate any "Ghost Bids" currently in the RabbitMQ queue.
        const updatedAuction = await AuctionRepo.resetAuction(client, bid.auction_id);
        
        // 6. COMMIT (Point of No Return)
        // The money is now safe in Postgres.
        await client.query('COMMIT');

        // 7. REDIS ATOMIC RESET
        // We run a Lua script to reset the auction AND refund whoever Redis thinks is winning.
        // This ensures the frontend updates instantly and the Redis winner gets their money back.
        const redisResult = await CresetAuctionAndRefund(
            bid.auction_id, 
            updatedAuction.starting_price
        );

        // 8. NOTIFICATIONS
        
        // A. Notify the DB User (The one we definitely refunded in Postgres)
        emitBalanceUpdate(Number(bid.bidder_id), Number(refundedUser.balance));

        // B. Notify the Redis User (If different from DB user due to race condition)
        // This ensures the user who *thought* they were winning sees their money back instantly.
        if (redisResult.refundedUserId && String(redisResult.refundedUserId) !== String(bid.bidder_id)) {
            emitBalanceUpdate(
                Number(redisResult.refundedUserId), 
                Number(redisResult.newBalance)
            );
        }

        // C. Broadcast Reset to All Users
        // Include the NEW VERSION so clients know to discard old data
        emitAuctionReset({
            id: updatedAuction.id,
            current_price: parseFloat(updatedAuction.starting_price),
            total_bids: 0,
            status: 'active',
           // version: updatedAuction.version
        });

        res.status(200).json({
            message: 'Bid cancelled. Auction restarted.',
            newBalance: refundedUser.balance
        });

    }  catch (err) {
    console.error('Bid Error:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
       return res.status(503).json({
         message: 'Bidding service is temporarily unavailable.',
         retryAfter: 5
       });
    }
    return res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
};

// Get all bids (Admin)(filter)(done)
const getAllBids = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const auction_id = req.query.auction_id ? parseInt(req.query.auction_id) : null;

    // Use repository with filters
    const bids = await BidRepo.getAllBids(con, {
      limit,
      offset,
      auction_id
    });

    const totalItems = await BidRepo.getTotalBidCount(con, auction_id);

    res.json({
      message: 'Bids fetched successfully',
      data: bids,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        limit
      },
      filter: {
        auction_id: auction_id || 'all'
      }
    });
  } catch (err) {
    console.error('GetAllBids error:', err);
    res.status(500).json({ message: 'Failed to get bids' });
  }
};

module.exports = {
  getBids,
  getWinningBid,
  createBid,
  getUserBids,
  cancelBid,
  getAllBids
};