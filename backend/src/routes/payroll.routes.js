const router = require('express').Router();
const payrollController = require('../controllers/payroll.controller');
const { authMiddleware, authorize } = require('../middleware/auth');

router.use(authMiddleware);
router.use(authorize('admin'));

// Empleados
router.get('/employees', (req, res, next) => payrollController.getEmployees(req, res, next));
router.post('/employees', (req, res, next) => payrollController.createEmployee(req, res, next));
router.put('/employees/:id', (req, res, next) => payrollController.updateEmployee(req, res, next));

// Nómina
router.get('/summary', (req, res, next) => payrollController.getSummary(req, res, next));
router.get('/entries', (req, res, next) => payrollController.getPayrollEntries(req, res, next));
router.post('/entries', (req, res, next) => payrollController.createPayrollEntry(req, res, next));
router.patch('/entries/:id/pay', (req, res, next) => payrollController.markAsPaid(req, res, next));
router.delete('/entries/:id', (req, res, next) => payrollController.deletePayrollEntry(req, res, next));

module.exports = router;
