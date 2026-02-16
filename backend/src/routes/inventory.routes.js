/**
 * Rutas de Inventario
 */
const router = require('express').Router();
const ctrl = require('../controllers/inventory.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Items
router.get('/items', ctrl.getItems);
router.post('/items', ctrl.createItem);
router.put('/items/:id', ctrl.updateItem);
router.delete('/items/:id', ctrl.deleteItem);

// Compras
router.get('/purchases', ctrl.getPurchases);
router.post('/purchases', ctrl.createPurchase);

// Análisis
router.get('/analysis', ctrl.analysis);

module.exports = router;
