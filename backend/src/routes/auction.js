const Router =require('express');
const {createAuction,getAllAuctions,getUserAuctions,updateAuction,deleteAuction,getAuctionById,getAllAuctionsAdmin,activateAuction}=require('../controllers/auctionController');
const adminMiddleware=require('../middlewares/adminMiddleware');
const authMiddleware = require('../middlewares/authHandler');

const router=Router();
router.get('/user/:userId',authMiddleware,getUserAuctions);

// Public
router.get('/all', getAllAuctions);
router.get('/:id', getAuctionById);

// User routes
router.post('/create', authMiddleware, createAuction);
router.patch('/update/:id', authMiddleware, updateAuction);      // User only, before bids
router.delete('/delete/:id', authMiddleware, deleteAuction);     // User before bids

// Admin routes
router.get('/admin/all', authMiddleware, adminMiddleware, getAllAuctionsAdmin);
router.patch('/admin/activate/:id', authMiddleware, adminMiddleware, activateAuction);  // Admin only
router.delete('/admin/delete/:id', authMiddleware, adminMiddleware, deleteAuction);     // Admin can delete with bids

module.exports=router;
