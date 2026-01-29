const { Router } = require('express');
const { getBids, createBid, getBidByUser, getWinningBid, cancelBid, getAllBidsAdmin } = require('../controllers/bidController');
const adminMiddleware=require('../middlewares/adminMiddleware');
const authMiddleware = require('../middlewares/authHandler');

const router = Router();

//public routes
router.get('/auction/:auction_id', getBids);
router.get('/winning/:auction_id', getWinningBid);

//private routes
router.post('/create/:auction_id', authMiddleware, createBid);
// 4. Get all bids by the logged-in user (Protected)
// Use 'me' instead of passing user_id to prevent users from seeing each other's history
router.get('/me', authMiddleware, getBidByUser);

//admin routes
router.get('/admin/all', authMiddleware, adminMiddleware, getAllBidsAdmin);
router.patch('/cancel/:bid_id', authMiddleware, adminMiddleware, cancelBid);

module.exports = router;