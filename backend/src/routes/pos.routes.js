const router = require('express').Router();
const posController = require('../controllers/pos.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.post('/sales', (req, res, next) => posController.createSale(req, res, next));
router.get('/sales', (req, res, next) => posController.getSales(req, res, next));
router.get('/sales/summary', (req, res, next) => posController.getDailySummary(req, res, next));
router.get('/sales/:id', (req, res, next) => posController.getSaleById(req, res, next));
router.patch('/sales/:id/cancel', (req, res, next) => posController.cancelSale(req, res, next));

// Full Service Mode - Open Orders
router.get('/open-orders', (req, res, next) => posController.getOpenOrders(req, res, next));
router.post('/orders/:id/items', (req, res, next) => posController.addItemsToOrder(req, res, next));
router.post('/orders/:id/close', (req, res, next) => posController.closeOrder(req, res, next));

module.exports = router;
