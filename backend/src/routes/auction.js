const Router = require('express');
const { createAuction, getAllAuctions, getUserAuctions, updateAuction, deleteAuction, getAuctionById, getAllAuctionsAdmin, activateAuction, cancelAuction } = require('../controllers/auctionController');
const adminMiddleware = require('../middlewares/adminMiddleware');
const authMiddleware = require('../middlewares/authHandler');
const validate = require('../middlewares/validate');
const { createAuctionSchema, updateAuctionSchema, activateAuctionSchema, deleteAuctionSchema } = require('../validators/auctionSchemas');

const router = Router();

router.get('/user/:userId', authMiddleware, getUserAuctions);

// Public
router.get('/all', getAllAuctions);
router.get('/:id', getAuctionById);

// User routes
router.post('/create', authMiddleware, validate(createAuctionSchema), createAuction);
router.patch('/update/:id', authMiddleware, validate(updateAuctionSchema), updateAuction);
router.delete('/delete/:id', authMiddleware, validate(deleteAuctionSchema), cancelAuction);

// Admin routes
router.get('/admin/all', authMiddleware, adminMiddleware, getAllAuctionsAdmin);
router.patch('/admin/activate/:id', authMiddleware, adminMiddleware, validate(activateAuctionSchema), activateAuction);
router.delete('/admin/delete/:id', authMiddleware, adminMiddleware, validate(deleteAuctionSchema), deleteAuction);

module.exports = router;

