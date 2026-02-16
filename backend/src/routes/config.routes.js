const router = require('express').Router();
const configController = require('../controllers/config.controller');
const { authMiddleware, authorize } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res, next) => configController.getConfig(req, res, next));
router.get('/:key', (req, res, next) => configController.getConfigByKey(req, res, next));
router.put('/', authorize('admin'), (req, res, next) => configController.updateConfig(req, res, next));

module.exports = router;
