/**
 * Rutas de Zonas del Restaurante
 */
const router = require('express').Router();
const ctrl = require('../controllers/zones.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', ctrl.getZones);
router.post('/', ctrl.createZone);
router.put('/:id', ctrl.updateZone);
router.delete('/:id', ctrl.deleteZone);

module.exports = router;
