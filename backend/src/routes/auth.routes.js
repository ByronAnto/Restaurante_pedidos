const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware, authorize } = require('../middleware/auth');

// Rutas públicas
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/register', authMiddleware, authorize('admin'), (req, res, next) => authController.register(req, res, next));

// Rutas protegidas
router.get('/profile', authMiddleware, (req, res, next) => authController.getProfile(req, res, next));
router.get('/users', authMiddleware, authorize('admin'), (req, res, next) => authController.listUsers(req, res, next));
router.patch('/users/:id/toggle', authMiddleware, authorize('admin'), (req, res, next) => authController.toggleUserActive(req, res, next));
router.put('/users/:id', authMiddleware, authorize('admin'), (req, res, next) => authController.updateUser(req, res, next));
router.patch('/users/:id/password', authMiddleware, authorize('admin'), (req, res, next) => authController.resetPassword(req, res, next));
router.delete('/users/:id', authMiddleware, authorize('admin'), (req, res, next) => authController.deleteUser(req, res, next));

module.exports = router;
