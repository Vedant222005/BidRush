const { Router } = require('express');
const { getSignature } = require('../controllers/cloudinary');
const authMiddleware = require('../middlewares/authHandler');

const router = Router();

//Why authMiddleware? Only authenticated users should be able to upload images.
// Only logged-in users can get upload signature
router.get('/signature', authMiddleware, getSignature);

module.exports = router;