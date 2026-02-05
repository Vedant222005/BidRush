const Router = require('express');

const { login, register, logout, getMe, getAllUsers, banUser, unbanUser, refresh } = require('../controllers/authController');
const adminMiddleware = require('../middlewares/adminMiddleware');
const authMiddleware = require('../middlewares/authHandler');
const validate = require('../middlewares/validate');
const { loginSchema, registerSchema } = require('../validators/authSchemas');

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/register', validate(registerSchema), register);

router.post('/refresh/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);
router.get('/admin/users', authMiddleware, adminMiddleware, getAllUsers);
router.patch('/admin/users/:userId/ban', authMiddleware, adminMiddleware, banUser);
router.patch('/admin/users/:userId/unban', authMiddleware, adminMiddleware, unbanUser);

router.post('/refresh', refresh);

module.exports = router;


