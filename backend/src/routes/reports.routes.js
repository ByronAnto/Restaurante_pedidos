/**
 * Rutas de Reportes Avanzados
 */
const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Dashboard general
router.get('/dashboard', ctrl.dashboard);

// Financieros
router.get('/pnl', ctrl.pnl);
router.get('/pnl-trend', ctrl.pnlTrend);
router.get('/cash-flow', ctrl.cashFlow);

// Operacionales
router.get('/sales-by-hour', ctrl.salesByHour);
router.get('/ticket-stats', ctrl.ticketStats);
router.get('/top-products', ctrl.topProducts);
router.get('/abc', ctrl.abcProducts);
router.get('/payment-methods', ctrl.paymentMethods);
router.get('/order-types', ctrl.orderTypes);

// Estratégicos
router.get('/menu-engineering', ctrl.menuEngineering);
router.get('/comparison', ctrl.comparison);

module.exports = router;
