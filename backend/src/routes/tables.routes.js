/**
 * Rutas de Mesas
 */
const router = require('express').Router();
const ctrl = require('../controllers/tables.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', ctrl.getTables);
router.get('/map', ctrl.getMap);
router.post('/', ctrl.createTable);
router.put('/:id', ctrl.updateTable);
router.delete('/:id', ctrl.deleteTable);

module.exports = router;
