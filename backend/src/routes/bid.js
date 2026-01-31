const { Router } = require('express');
const { getBids, createBid, getUserBids, getWinningBid, cancelBid, getAllBids } = require('../controllers/bidController');
const adminMiddleware = require('../middlewares/adminMiddleware');
const authMiddleware = require('../middlewares/authHandler');
const validate = require('../middlewares/validate');
const { createBidSchema, cancelBidSchema, getBidsByAuctionSchema } = require('../validators/bidSchemas');

const router = Router();

// Public routes
router.get('/auction/:auction_id', validate(getBidsByAuctionSchema), getBids);
router.get('/winning/:auction_id', getWinningBid);

// Private routes
router.post('/create/:auction_id', authMiddleware, validate(createBidSchema), createBid);
router.get('/me', authMiddleware, getUserBids);

// Admin routes
router.get('/admin/all', authMiddleware, adminMiddleware, getAllBids);
router.patch('/cancel/:bid_id', authMiddleware, adminMiddleware, validate(cancelBidSchema), cancelBid);

module.exports = router;
