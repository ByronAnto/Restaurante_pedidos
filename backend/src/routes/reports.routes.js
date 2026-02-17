/**
 * Rutas de Reportes - Business Intelligence
 */
const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Dashboard general
router.get('/dashboard', ctrl.dashboard);

// Transacciones
router.get('/transactions', ctrl.transactions);
router.get('/periods-list', ctrl.periodsList);

// Productos / Platos
router.get('/top-dishes', ctrl.topDishes);
router.get('/top-products', ctrl.topProducts);
router.get('/abc', ctrl.abcProducts);

// Análisis BI
router.get('/day-analysis', ctrl.dayAnalysis);
router.get('/hourly-heatmap', ctrl.hourlyHeatmap);

// Financieros
router.get('/pnl', ctrl.pnl);
router.get('/pnl-trend', ctrl.pnlTrend);
router.get('/cash-flow', ctrl.cashFlow);

// Operacionales
router.get('/sales-by-hour', ctrl.salesByHour);
router.get('/ticket-stats', ctrl.ticketStats);
router.get('/payment-methods', ctrl.paymentMethods);
router.get('/order-types', ctrl.orderTypes);

// Estratégicos
router.get('/menu-engineering', ctrl.menuEngineering);
router.get('/comparison', ctrl.comparison);

module.exports = router;
