const router = require('express').Router();
const kitchenController = require('../controllers/kitchen.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/orders', (req, res, next) => kitchenController.getOrders(req, res, next));
router.get('/orders/active', (req, res, next) => kitchenController.getActiveOrders(req, res, next));
router.patch('/orders/:id/status', (req, res, next) => kitchenController.updateOrderStatus(req, res, next));

module.exports = router;
