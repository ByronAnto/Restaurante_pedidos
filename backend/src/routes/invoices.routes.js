const router = require('express').Router();
const invoicesController = require('../controllers/invoices.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res, next) => invoicesController.getInvoices(req, res, next));
router.get('/:id', (req, res, next) => invoicesController.getInvoiceById(req, res, next));
router.post('/nota-venta', (req, res, next) => invoicesController.createNotaVenta(req, res, next));

module.exports = router;
