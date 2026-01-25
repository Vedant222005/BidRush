const Router =require('express');
const {createAuction,getAllAuctions,getUserAuctions,updateAuction,deleteAuction,activateAuction}=require('../controllers/auctionController');
const authMiddleware = require('../middlewares/authHandler');

const router=Router();

router.post('/create', authMiddleware, createAuction);
router.get('/all',getAllAuctions);
router.get('/user/:userId',getUserAuctions);
router.patch('/update/:id', authMiddleware, updateAuction);
router.delete('/delete/:id', authMiddleware, deleteAuction);
router.patch('/activate/:id', authMiddleware, activateAuction);

module.exports=router;
