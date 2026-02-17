const router = require('express').Router();
const productsController = require('../controllers/products.controller');
const { authMiddleware, authorize } = require('../middleware/auth');

router.use(authMiddleware);

// Categorías
router.get('/categories', (req, res, next) => productsController.getCategories(req, res, next));
router.post('/categories', authorize('admin'), (req, res, next) => productsController.createCategory(req, res, next));
router.put('/categories/:id', authorize('admin'), (req, res, next) => productsController.updateCategory(req, res, next));
router.delete('/categories/:id', authorize('admin'), (req, res, next) => productsController.deleteCategory(req, res, next));

// Productos
router.get('/', (req, res, next) => productsController.getProducts(req, res, next));
router.get('/:id', (req, res, next) => productsController.getProductById(req, res, next));
router.post('/', authorize('admin'), (req, res, next) => productsController.createProduct(req, res, next));
router.put('/:id', authorize('admin'), (req, res, next) => productsController.updateProduct(req, res, next));
router.delete('/:id', authorize('admin'), (req, res, next) => productsController.deleteProduct(req, res, next));

// Modificadores de producto
router.get('/:productId/modifiers', (req, res, next) => productsController.getModifiersByProduct(req, res, next));
router.put('/:productId/modifiers', authorize('admin'), (req, res, next) => productsController.saveModifiers(req, res, next));

module.exports = router;
