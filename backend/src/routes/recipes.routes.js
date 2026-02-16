/**
 * Rutas de Recetas
 */
const router = require('express').Router();
const ctrl = require('../controllers/recipes.controller');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/analysis', ctrl.analysis);
router.get('/:productId', ctrl.getRecipe);
router.post('/', ctrl.addIngredient);
router.delete('/:id', ctrl.removeIngredient);

module.exports = router;
