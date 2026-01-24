const Router =require('express');
const {createAuction,getAllAuctions,getUserAuctions,updateAuction,deleteAuction}=require('../controllers/auctionController');
const router=Router();

router.post('/create',createAuction);
router.get('/all',getAllAuctions);
router.get('/user/:userId',getUserAuctions);
router.put('/update/:id',updateAuction);
router.delete('/delete/:id',deleteAuction);

module.exports=router;
