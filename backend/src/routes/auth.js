const Router = require('express');

const { login, register, logout, getMe, getAllUsers } = require('../controllers/authController');
const adminMiddleware = require('../middlewares/adminMiddleware');
const authMiddleware = require('../middlewares/authHandler');

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout',authMiddleware, logout);
router.get('/me', authMiddleware, getMe);
router.get('/admin/users', authMiddleware, adminMiddleware, getAllUsers);

module.exports = router;
