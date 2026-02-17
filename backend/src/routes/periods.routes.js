const router = require('express').Router();
const periodsController = require('../controllers/periods.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/current', (req, res, next) => periodsController.getCurrent(req, res, next));
router.post('/open', (req, res, next) => periodsController.openPeriod(req, res, next));
router.post('/close', (req, res, next) => periodsController.closePeriod(req, res, next));
router.get('/history', (req, res, next) => periodsController.getHistory(req, res, next));
router.post('/withdrawals', (req, res, next) => periodsController.createWithdrawal(req, res, next));
router.get('/withdrawals', (req, res, next) => periodsController.getWithdrawals(req, res, next));

module.exports = router;
