const con = require('../config/db');
const { emitNewBid, emitBalanceUpdate } = require('../webSocket/socketServer');
const BidRepo = require('../repositories/bidRepository');
const AuctionRepo = require('../repositories/auctionRepository');
const UserRepo = require('../repositories/userRepository');

// Get bids for an auction with pagination
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

// Get winning bid for an auction
const getWinningBid = async (req, res) => {
  try {
    const { auction_id } = req.params;

    // Use repository
    const winningBid = await BidRepo.getWinningBid(con, auction_id);

    if (!winningBid) {
      return res.status(404).json({ message: 'No winning bid found' });
    }

    res.json({
      message: 'Winning bid fetched successfully',
      data: winningBid
    });
  } catch (err) {
    console.error("GetWinningBid Error:", err);
    res.status(500).json({ message: 'Failed to get winning bid' });
  }
};

// Create new bid
const createBid = async (req, res) => {
  const client = await con.connect();
  try {
    const { auction_id } = req.params;
    const { bid_amount } = req.body;
    const user_id = req.user.id;

    // 1. START TRANSACTION
    await client.query('BEGIN');

    // 2. LOCK THE USER - Use repository
    const user = await UserRepo.lockAndGetUser(client, user_id);

    if (parseFloat(user.balance) < bid_amount) {
      throw new Error('Insufficient tokens in your wallet.');
    }

    // 3. LOCK THE AUCTION - Use repository
    const auction = await AuctionRepo.lockAndGetAuction(client, auction_id);

    if (!auction) throw new Error('Auction not found');

    // 4. BUSINESS VALIDATIONS
    if (auction.status !== 'active') throw new Error('Auction is not accepting bids.');
    if (new Date() > new Date(auction.end_time)) throw new Error('Auction has already ended.');
    if (auction.seller_id === user_id) throw new Error('You cannot bid on your own item.');

    // 5. CHECK PREVIOUS WINNING BIDDER - Use repository
    const lastBidder = await BidRepo.lockAndGetWinningBid(client, auction_id);

    if (lastBidder?.bidder_id === user_id) {
      throw new Error('You are already the leading bidder.');
    }

    const minRequiredBid = parseFloat(auction.current_bid) + parseFloat(auction.bid_increment || 1.0);
    if (bid_amount < minRequiredBid) {
      throw new Error(`The minimum allowed bid is ${minRequiredBid} tokens.`);
    }

    // --- START ATOMIC DATA UPDATES ---

    // A. Refund the Previous Bidder (If they exist) - Use repository
    if (lastBidder) {
      await UserRepo.updateBalance(client, lastBidder.bidder_id, parseFloat(lastBidder.amount), null);
      await BidRepo.markBidAsOutbid(client, auction_id);
    }

    // B. Deduct Tokens from New Bidder - Use repository
    const updatedUser = await UserRepo.updateBalance(client, user_id, -bid_amount, user.version);

    if (!updatedUser) {
      throw new Error('Transaction conflict: Your balance was updated elsewhere. Please try again.');
    }

    // C. Insert the New Winning Bid - Use repository
    const newBid = await BidRepo.createBid(client, {
      auction_id,
      bidder_id: user_id,
      amount: bid_amount,
      ip_address: req.ip
    });

    // D. Update Auction State - Use repository
    await AuctionRepo.updateAuctionBid(client, auction_id, bid_amount);

    // 6. FINALIZE
    await client.query('COMMIT');

    // Trigger Real-time updates (After successful commit)
    emitNewBid(auction_id, {
      ...newBid,
      new_balance: updatedUser.balance
    });

    // Notify current bidder of their new balance
    emitBalanceUpdate(user_id, updatedUser.balance);

    // Notify previous bidder of their refund (if they exist)
    if (lastBidder) {
      const prevUser = await UserRepo.getUserById(con, lastBidder.bidder_id);
      if (prevUser) {
        emitBalanceUpdate(lastBidder.bidder_id, prevUser.balance);
      }
    }

    res.status(201).json({
      message: 'Bid placed successfully!',
      bid: newBid,
      newBalance: updatedUser.balance
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Bidding Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to place bid.' });
  } finally {
    client.release();
  }
};

// Get user's bids
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

// Cancel bid - Admin only
const cancelBid = async (req, res) => {
  const { bid_id } = req.params;
  const client = await con.connect();

  try {
    // 1. START TRANSACTION
    await client.query('BEGIN');

    // 2. FETCH BID & LOCK - Use repository
    const bid = await BidRepo.getBidWithDetails(client, bid_id);

    if (!bid) {
      throw new Error('Bid not found');
    }

    // 3. VALIDATION: Only allow cancelling the WINNING bid
    if (bid.status !== 'winning') {
      throw new Error('Only the current winning bid can be cancelled to trigger a restart');
    }

    if (bid.auction_status !== 'active') {
      throw new Error('Cannot cancel bids on a closed or pending auction');
    }

    // 4. REFUND THE WINNING BIDDER - Use repository
    const refundedUser = await UserRepo.updateBalance(
      client,
      bid.bidder_id,
      bid.amount,
      bid.user_version
    );

    if (!refundedUser) {
      throw new Error('Concurrency Error: User balance updated during refund.');
    }

    // 5. CANCEL THE BID RECORD - Use repository
    await BidRepo.cancelBid(client, bid_id);

    // 6. RESTART THE AUCTION - Use repository
    await AuctionRepo.resetAuction(client, bid.auction_id);

    // 7. COMMIT
    await client.query('COMMIT');

    // Notify user of refund
    emitBalanceUpdate(bid.bidder_id, refundedUser.balance);

    res.status(200).json({
      message: 'Winning bid cancelled. Money refunded and auction has been restarted.',
      newBalance: refundedUser.balance
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Cancellation Error:", err.message);
    res.status(400).json({ message: err.message || 'Failed to cancel bid' });
  } finally {
    client.release();
  }
};

// Get all bids (Admin)
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