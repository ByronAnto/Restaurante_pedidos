const router = require('express').Router();
const investmentsController = require('../controllers/investments.controller');
const { authMiddleware, authorize } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res, next) => investmentsController.getInvestments(req, res, next));
router.post('/', (req, res, next) => investmentsController.createInvestment(req, res, next));
router.put('/:id', (req, res, next) => investmentsController.updateInvestment(req, res, next));
router.delete('/:id', authorize('admin'), (req, res, next) => investmentsController.deleteInvestment(req, res, next));

module.exports = router;
