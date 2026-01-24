const { Router } = require('express');
const { 
    getBids, 
    createBid, 
    getBidByUser, 
    getWinningBid, 
    cancelBid // For Admins only
} = require('../controllers/bidController');

const authMiddleware = require('../middlewares/authHandler')

const router = Router();
router.get('/auction/:auction_id', getBids);
router.get('/winning/:auction_id', getWinningBid);
router.post('/create/:auction_id', authMiddleware, createBid);

// 4. Get all bids by the logged-in user (Protected)
// Use 'me' instead of passing user_id to prevent users from seeing each other's history
router.get('/me', authMiddleware, getBidByUser);

// 5. Cancel a bid (Admin only - for fraud or mistakes)
// We don't DELETE; we update the status to 'cancelled'
router.patch('/cancel/:bid_id', authMiddleware, cancelBid);

module.exports = router;